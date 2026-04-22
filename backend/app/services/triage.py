import json
from pathlib import Path
from typing import Any

import anthropic
from langfuse import get_client, observe
from pydantic import BaseModel, field_validator

from app.core.config import settings

PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"

_async_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


# ---------------------------------------------------------------------------
# Pydantic output models
# ---------------------------------------------------------------------------


class RecommendedActions(BaseModel):
    immediate: list[str] = []
    monitor: list[str] = []
    escalate_or_redirect: list[str] = []


class FollowUpItem(BaseModel):
    action: str
    priority: str  # high | medium | low
    assignee: str  # charge_nurse | bedside_nurse | physician | registration | specialist


class TriageAssessment(BaseModel):
    urgency: str  # IMMEDIATE | MONITOR | CAN WAIT
    escalate_or_redirect: str  # Escalate | Redirect | Standard
    confidence: float

    @field_validator("urgency")
    @classmethod
    def normalize_urgency(cls, v: str) -> str:
        return v.upper()
    recommended_actions: RecommendedActions
    rationale: str
    red_flags: list[str] = []
    missing_fields: list[str] = []
    follow_up_checklist: list[FollowUpItem] = []


class DischargeSummary(BaseModel):
    patient_overview: str
    clinical_summary: str
    assessment: str
    outstanding_items: list[str] = []
    discharge_instructions: str | None = None
    handoff_notes: str
    generated_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _load_prompt(filename: str) -> str:
    return (PROMPTS_DIR / filename).read_text(encoding="utf-8")


def _make_strict_schema(model: type[BaseModel]) -> dict[str, Any]:
    schema = model.model_json_schema()
    schema.pop("title", None)
    _apply_no_additional_props(schema)
    return schema


def _apply_no_additional_props(node: dict[str, Any]) -> None:
    if node.get("type") == "object" or "properties" in node:
        node["additionalProperties"] = False
        for child in node.get("properties", {}).values():
            _apply_no_additional_props(child)
    if "items" in node:
        _apply_no_additional_props(node["items"])
    for defn in node.get("$defs", {}).values():
        _apply_no_additional_props(defn)


# ---------------------------------------------------------------------------
# Triage assessment
# ---------------------------------------------------------------------------


@observe(as_type="generation", name="assess_patient_triage")
async def assess_patient_triage(patient_data: dict[str, Any]) -> TriageAssessment:
    system_prompt = _load_prompt("system_triage.md")
    user_template = _load_prompt("patient_triage_request.md")
    user_message = user_template.replace(
        "{patient_json}",
        json.dumps(patient_data, indent=2, default=str),
    )

    response = await _async_client.messages.create(
        model=settings.TRIAGE_MODEL,
        max_tokens=2048,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        output_config={
            "format": {
                "type": "json_schema",
                "schema": _make_strict_schema(TriageAssessment),
            }
        },
        messages=[{"role": "user", "content": user_message}],
    )

    text = next(b.text for b in response.content if b.type == "text")
    result = TriageAssessment.model_validate_json(text)

    get_client().update_current_generation(
        model=settings.TRIAGE_MODEL,
        input=[{"role": "user", "content": user_message}],
        output=text,
        usage_details={
            "input": response.usage.input_tokens,
            "output": response.usage.output_tokens,
        },
        metadata={"patient_id": patient_data.get("id"), "urgency": result.urgency},
    )

    return result


# ---------------------------------------------------------------------------
# Symptom follow-up Q&A
# ---------------------------------------------------------------------------


@observe(as_type="generation", name="symptom_followup")
async def symptom_followup(
    patient_data: dict[str, Any],
    nurse_question: str,
    prior_assessment: TriageAssessment | None = None,
) -> str:
    system_prompt = _load_prompt("system_symptom_followup.md")

    context_parts = [
        f"Patient data:\n{json.dumps(patient_data, indent=2, default=str)}",
    ]
    if prior_assessment:
        context_parts.append(
            f"Prior triage assessment:\n"
            f"Urgency: {prior_assessment.urgency}\n"
            f"Rationale: {prior_assessment.rationale}"
        )
    context_parts.append(f"Nurse question: {nurse_question}")

    user_message = "\n\n".join(context_parts)

    response = await _async_client.messages.create(
        model=settings.FOLLOWUP_MODEL,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )

    answer = next(b.text for b in response.content if b.type == "text")

    get_client().update_current_generation(
        model=settings.FOLLOWUP_MODEL,
        input=nurse_question,
        output=answer,
        usage_details={
            "input": response.usage.input_tokens,
            "output": response.usage.output_tokens,
        },
        metadata={"patient_id": patient_data.get("id")},
    )

    return answer


# ---------------------------------------------------------------------------
# Discharge / handoff summary
# ---------------------------------------------------------------------------


@observe(as_type="generation", name="generate_discharge_summary")
async def generate_discharge_summary(
    patient_data: dict[str, Any],
    visit_notes: str,
    assessment: TriageAssessment | None = None,
) -> DischargeSummary:
    system_prompt = _load_prompt("system_discharge_summary.md")

    context = {
        "patient": patient_data,
        "visit_notes": visit_notes,
        "triage_assessment": assessment.model_dump() if assessment else None,
    }
    user_message = (
        "Generate a handoff summary for the following patient visit:\n\n"
        f"```json\n{json.dumps(context, indent=2, default=str)}\n```"
    )

    response = await _async_client.messages.create(
        model=settings.DISCHARGE_MODEL,
        max_tokens=2048,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        output_config={
            "format": {
                "type": "json_schema",
                "schema": _make_strict_schema(DischargeSummary),
            }
        },
        messages=[{"role": "user", "content": user_message}],
    )

    text = next(b.text for b in response.content if b.type == "text")
    result = DischargeSummary.model_validate_json(text)

    get_client().update_current_generation(
        model=settings.DISCHARGE_MODEL,
        input=user_message,
        output=text,
        usage_details={
            "input": response.usage.input_tokens,
            "output": response.usage.output_tokens,
        },
        metadata={"patient_id": patient_data.get("id")},
    )

    return result

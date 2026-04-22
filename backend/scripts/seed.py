#!/usr/bin/env python3
"""
Seed script for the ED Triage Support database.
Run from the backend/ directory: python -m scripts.seed
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models.patient import Patient, Vitals
from app.models.staff import Staff
from app.models.user import User


STAFF = [
    {"first_name": "James", "last_name": "Rivera", "role": "physician", "specialty": "Emergency Medicine", "shift": "day", "is_on_duty": True},
    {"first_name": "Priya", "last_name": "Sharma", "role": "physician", "specialty": "Emergency Medicine", "shift": "day", "is_on_duty": True},
    {"first_name": "David", "last_name": "Kowalski", "role": "physician", "specialty": "Cardiology", "shift": "day", "is_on_duty": False},
    {"first_name": "Elena", "last_name": "Vasquez", "role": "specialist", "specialty": "Trauma Surgery", "shift": "day", "is_on_duty": True},
    {"first_name": "Marcus", "last_name": "Thompson", "role": "charge_nurse", "specialty": None, "shift": "day", "is_on_duty": True},
    {"first_name": "Sofia", "last_name": "Chen", "role": "nurse", "specialty": None, "shift": "day", "is_on_duty": True},
    {"first_name": "Aaliyah", "last_name": "Johnson", "role": "nurse", "specialty": None, "shift": "day", "is_on_duty": True},
    {"first_name": "Kevin", "last_name": "O'Brien", "role": "nurse", "specialty": None, "shift": "day", "is_on_duty": True},
    {"first_name": "Rachel", "last_name": "Nguyen", "role": "nurse", "specialty": None, "shift": "evening", "is_on_duty": False},
    {"first_name": "Tyler", "last_name": "Patel", "role": "nurse", "specialty": None, "shift": "evening", "is_on_duty": False},
    {"first_name": "Hannah", "last_name": "Brooks", "role": "physician", "specialty": "Emergency Medicine", "shift": "evening", "is_on_duty": False},
    {"first_name": "Carlos", "last_name": "Mendez", "role": "specialist", "specialty": "Orthopedics", "shift": "day", "is_on_duty": True},
]

PATIENTS_INTAKE = [
    {"first_name": "John", "last_name": "Smith", "dob": "1979-03-15", "gender": "Male", "chief_complaint": "Chest tightness and shortness of breath for the past 2 hours", "medical_history": ["Hypertension", "Hyperlipidemia"], "allergies": ["Penicillin"], "medications": ["Lisinopril 10mg", "Atorvastatin 40mg"]},
    {"first_name": "Maria", "last_name": "Garcia", "dob": "1992-07-22", "gender": "Female", "chief_complaint": "Severe abdominal pain, lower right quadrant, onset 4 hours ago", "medical_history": [], "allergies": ["Sulfa drugs"], "medications": []},
    {"first_name": "Robert", "last_name": "Johnson", "dob": "1957-11-08", "gender": "Male", "chief_complaint": "Difficulty breathing, worsening over 3 days, productive cough", "medical_history": ["COPD", "Type 2 Diabetes"], "allergies": [], "medications": ["Albuterol inhaler", "Metformin 500mg", "Tiotropium inhaler"]},
    {"first_name": "Emily", "last_name": "Davis", "dob": "1996-04-30", "gender": "Female", "chief_complaint": "Severe headache with visual disturbances, worst of my life", "medical_history": ["Migraines"], "allergies": ["Aspirin"], "medications": ["Topiramate 50mg"]},
    {"first_name": "Michael", "last_name": "Wilson", "dob": "1972-09-14", "gender": "Male", "chief_complaint": "Lower back pain radiating down left leg, started this morning", "medical_history": ["Lumbar disc herniation"], "allergies": [], "medications": ["Ibuprofen PRN"]},
    {"first_name": "Sarah", "last_name": "Brown", "dob": "1983-01-25", "gender": "Female", "chief_complaint": "Nausea and vomiting 5 times today, unable to keep fluids down", "medical_history": ["GERD"], "allergies": ["Codeine"], "medications": ["Omeprazole 20mg"]},
    {"first_name": "David", "last_name": "Jones", "dob": "1986-06-18", "gender": "Male", "chief_complaint": "Deep laceration to right hand from kitchen accident, bleeding controlled", "medical_history": [], "allergies": [], "medications": []},
    {"first_name": "Jennifer", "last_name": "Martinez", "dob": "1995-12-03", "gender": "Female", "chief_complaint": "Burning urination, pelvic pain, and fever measured 101F at home", "medical_history": ["Recurrent UTIs"], "allergies": ["Sulfa drugs"], "medications": []},
    {"first_name": "William", "last_name": "Taylor", "dob": "1950-05-07", "gender": "Male", "chief_complaint": "Sudden confusion, not recognizing family members, began 1 hour ago", "medical_history": ["Atrial Fibrillation", "Hypertension"], "allergies": [], "medications": ["Warfarin 5mg", "Metoprolol 25mg"]},
    {"first_name": "Amanda", "last_name": "Anderson", "dob": "1969-08-19", "gender": "Female", "chief_complaint": "Dizziness and near-fainting episodes when standing, 3 episodes today", "medical_history": ["Hypertension"], "allergies": ["NSAIDs"], "medications": ["Amlodipine 5mg"]},
    {"first_name": "James", "last_name": "Thomas", "dob": "1993-02-14", "gender": "Male", "chief_complaint": "Twisted ankle playing basketball, significant swelling and bruising", "medical_history": [], "allergies": [], "medications": []},
    {"first_name": "Lisa", "last_name": "Jackson", "dob": "1980-10-27", "gender": "Female", "chief_complaint": "High fever 103F, chills, body aches for 2 days, possible flu", "medical_history": ["Asthma"], "allergies": ["Amoxicillin"], "medications": ["Albuterol inhaler PRN"]},
    {"first_name": "Charles", "last_name": "White", "dob": "1962-03-31", "gender": "Male", "chief_complaint": "Headache and neck stiffness, home blood pressure reading was 180/110", "medical_history": ["Hypertension", "Diabetes"], "allergies": [], "medications": ["Metformin 1000mg", "Lisinopril 20mg"]},
    {"first_name": "Patricia", "last_name": "Harris", "dob": "1988-07-15", "gender": "Female", "chief_complaint": "Hives and facial swelling 30 minutes after eating shellfish at restaurant", "medical_history": ["Shellfish allergy"], "allergies": ["Shellfish"], "medications": ["EpiPen (carried)"]},
    {"first_name": "Joseph", "last_name": "Martin", "dob": "1976-11-22", "gender": "Male", "chief_complaint": "Sudden severe eye pain and blurry vision in left eye, started 2 hours ago", "medical_history": [], "allergies": [], "medications": []},
    {"first_name": "Barbara", "last_name": "Thompson", "dob": "1953-04-09", "gender": "Female", "chief_complaint": "Fell in bathroom, severe right hip pain, unable to bear weight", "medical_history": ["Osteoporosis", "Hypertension"], "allergies": ["Codeine"], "medications": ["Alendronate 70mg weekly", "Amlodipine 10mg"]},
    {"first_name": "Christopher", "last_name": "Garcia", "dob": "1997-09-05", "gender": "Male", "chief_complaint": "Found unresponsive by roommate, suspected drug overdose, now responsive but confused", "medical_history": ["Substance use disorder"], "allergies": [], "medications": []},
    {"first_name": "Susan", "last_name": "Martinez", "dob": "1965-06-28", "gender": "Female", "chief_complaint": "Severe toothache with jaw swelling and difficulty opening mouth, worsening over 2 days", "medical_history": ["Diabetes"], "allergies": [], "medications": ["Metformin 500mg"]},
    {"first_name": "Matthew", "last_name": "Robinson", "dob": "1941-01-16", "gender": "Male", "chief_complaint": "Generalized weakness and fatigue for 3 days, unable to get out of chair without assistance", "medical_history": ["Heart Failure", "Chronic Kidney Disease", "Diabetes"], "allergies": ["Morphine"], "medications": ["Furosemide 40mg", "Carvedilol 12.5mg", "Insulin glargine"]},
    {"first_name": "Nancy", "last_name": "Clark", "dob": "1991-05-11", "gender": "Female", "chief_complaint": "8 weeks pregnant, heavy vaginal bleeding and cramping for the past hour", "medical_history": [], "allergies": [], "medications": ["Prenatal vitamins"]},
]

PATIENTS_VITALS = [
    {"first_name": "Kevin", "last_name": "Lewis", "dob": "1979-04-22", "gender": "Male", "chief_complaint": "Chest pain with palpitations, history of atrial fibrillation, HR irregular", "medical_history": ["Atrial Fibrillation"], "allergies": [], "medications": ["Apixaban 5mg", "Metoprolol 50mg"], "vitals": {"heart_rate": 142, "bp_sys": 145, "bp_dia": 90, "temp": 37.1, "rr": 18, "spo2": 96}},
    {"first_name": "Lisa", "last_name": "Lee", "dob": "1986-08-14", "gender": "Female", "chief_complaint": "Worst headache of life, sudden thunderclap onset 45 minutes ago, neck stiffness", "medical_history": [], "allergies": [], "medications": [], "vitals": {"heart_rate": 88, "bp_sys": 162, "bp_dia": 98, "temp": 37.3, "rr": 16, "spo2": 99}},
    {"first_name": "Paul", "last_name": "Walker", "dob": "1963-12-03", "gender": "Male", "chief_complaint": "COPD exacerbation, using accessory muscles, minimally responsive to home nebulizer", "medical_history": ["COPD", "Chronic Bronchitis"], "allergies": ["Penicillin"], "medications": ["Tiotropium", "Fluticasone/Salmeterol", "Albuterol PRN"], "vitals": {"heart_rate": 108, "bp_sys": 138, "bp_dia": 84, "temp": 37.8, "rr": 28, "spo2": 87}},
    {"first_name": "Carol", "last_name": "Hall", "dob": "1975-03-17", "gender": "Female", "chief_complaint": "Blood sugar checked at home was 42 mg/dL, shaking, sweating, confused", "medical_history": ["Type 1 Diabetes"], "allergies": [], "medications": ["Insulin pump", "Glucagon kit"], "vitals": {"heart_rate": 112, "bp_sys": 122, "bp_dia": 76, "temp": 36.9, "rr": 18, "spo2": 98}},
    {"first_name": "Mark", "last_name": "Allen", "dob": "1969-07-29", "gender": "Male", "chief_complaint": "Post-seizure state, witnessed tonic-clonic seizure lasting 3 minutes, now postictal", "medical_history": ["Epilepsy"], "allergies": ["Carbamazepine"], "medications": ["Levetiracetam 1000mg twice daily"], "vitals": {"heart_rate": 96, "bp_sys": 148, "bp_dia": 88, "temp": 37.2, "rr": 14, "spo2": 97}},
    {"first_name": "Patricia", "last_name": "Young", "dob": "1982-01-06", "gender": "Female", "chief_complaint": "Asthma attack, not responding to home rescue inhaler, wheezing audible", "medical_history": ["Asthma"], "allergies": ["Aspirin", "NSAIDs"], "medications": ["Albuterol inhaler", "Fluticasone inhaler"], "vitals": {"heart_rate": 118, "bp_sys": 128, "bp_dia": 80, "temp": 37.0, "rr": 24, "spo2": 91}},
    {"first_name": "George", "last_name": "Hernandez", "dob": "1956-09-21", "gender": "Male", "chief_complaint": "Left-sided facial droop, slurred speech, and arm weakness, onset 40 minutes ago", "medical_history": ["Hypertension", "Type 2 Diabetes", "Hyperlipidemia"], "allergies": [], "medications": ["Amlodipine 10mg", "Metformin 1000mg", "Rosuvastatin 20mg"], "vitals": {"heart_rate": 84, "bp_sys": 188, "bp_dia": 104, "temp": 37.1, "rr": 16, "spo2": 97}},
    {"first_name": "Helen", "last_name": "King", "dob": "1947-05-13", "gender": "Female", "chief_complaint": "Syncope at grocery store, witnessed LOC for approximately 30 seconds, no prodrome", "medical_history": ["Hypertension", "Aortic Stenosis"], "allergies": ["Penicillin"], "medications": ["Atenolol 50mg", "Furosemide 20mg"], "vitals": {"heart_rate": 52, "bp_sys": 98, "bp_dia": 62, "temp": 36.8, "rr": 14, "spo2": 97}},
    {"first_name": "Donald", "last_name": "Wright", "dob": "1973-10-08", "gender": "Male", "chief_complaint": "Severe abdominal pain, rigid abdomen, guarding and rebound tenderness on palpation", "medical_history": ["Peptic Ulcer Disease"], "allergies": [], "medications": ["Omeprazole 20mg"], "vitals": {"heart_rate": 124, "bp_sys": 108, "bp_dia": 70, "temp": 38.6, "rr": 22, "spo2": 96}},
    {"first_name": "Ruth", "last_name": "Lopez", "dob": "1989-02-25", "gender": "Female", "chief_complaint": "Found by friend, ingested unknown quantity of pills, friend reports opioid use", "medical_history": ["Substance use disorder", "Depression"], "allergies": [], "medications": ["Sertraline 50mg"], "vitals": {"heart_rate": 58, "bp_sys": 86, "bp_dia": 54, "temp": 36.2, "rr": 8, "spo2": 88}},
]

PATIENTS_DOC_VISIT = [
    {"first_name": "Steven", "last_name": "Hill", "dob": "1980-06-14", "gender": "Male", "chief_complaint": "STEMI confirmed on EKG, ongoing chest pain 8/10, diaphoretic, cath lab notified", "medical_history": ["Hypertension", "Smoker"], "allergies": [], "medications": ["Aspirin 81mg", "Atorvastatin 40mg"], "vitals": {"heart_rate": 98, "bp_sys": 142, "bp_dia": 88, "temp": 37.0, "rr": 20, "spo2": 95}},
    {"first_name": "Maria", "last_name": "Scott", "dob": "1969-11-30", "gender": "Female", "chief_complaint": "RLQ pain, positive urine HCG, severe pain 9/10, concern for ectopic pregnancy", "medical_history": ["Prior ectopic pregnancy"], "allergies": ["Latex"], "medications": [], "vitals": {"heart_rate": 116, "bp_sys": 96, "bp_dia": 58, "temp": 37.4, "rr": 22, "spo2": 98}},
    {"first_name": "Jason", "last_name": "Green", "dob": "1995-04-07", "gender": "Male", "chief_complaint": "Sepsis criteria met: fever 39.8C, HR 122, BP 88/56, source unknown, on broad-spectrum ABX", "medical_history": ["No significant history"], "allergies": [], "medications": [], "vitals": {"heart_rate": 122, "bp_sys": 88, "bp_dia": 56, "temp": 39.8, "rr": 24, "spo2": 94}},
    {"first_name": "Rebecca", "last_name": "Adams", "dob": "1961-08-19", "gender": "Female", "chief_complaint": "Pleuritic chest pain, tachycardia, elevated D-dimer 4.8, CT PE protocol ordered", "medical_history": ["Recent hip replacement surgery 3 weeks ago"], "allergies": ["Heparin (HIT)"], "medications": ["Aspirin 81mg"], "vitals": {"heart_rate": 114, "bp_sys": 118, "bp_dia": 74, "temp": 37.6, "rr": 20, "spo2": 93}},
    {"first_name": "Timothy", "last_name": "Baker", "dob": "1952-01-25", "gender": "Male", "chief_complaint": "Tearing back pain radiating to abdomen, pulsatile mass palpated, stat CT aorta ordered", "medical_history": ["Hypertension", "Smoker", "Family history AAA"], "allergies": [], "medications": ["Lisinopril 40mg", "Amlodipine 10mg"], "vitals": {"heart_rate": 106, "bp_sys": 168, "bp_dia": 92, "temp": 37.1, "rr": 18, "spo2": 97}},
]

PATIENTS_POST_VISIT = [
    {"first_name": "Dorothy", "last_name": "Nelson", "dob": "1966-09-12", "gender": "Female", "chief_complaint": "Post-appendectomy, recovering well, awaiting discharge with home care instructions", "medical_history": ["Appendicitis (acute)"], "allergies": ["Morphine"], "medications": ["Oxycodone 5mg PRN", "Ibuprofen 600mg"], "vitals": {"heart_rate": 78, "bp_sys": 122, "bp_dia": 76, "temp": 37.0, "rr": 14, "spo2": 99}},
    {"first_name": "Ronald", "last_name": "Carter", "dob": "1957-02-18", "gender": "Male", "chief_complaint": "Community-acquired pneumonia, temperature normalized, tolerating oral fluids, oral ABX arranged", "medical_history": ["COPD", "Diabetes"], "allergies": [], "medications": ["Azithromycin 500mg", "Albuterol inhaler"], "vitals": {"heart_rate": 82, "bp_sys": 128, "bp_dia": 78, "temp": 37.2, "rr": 16, "spo2": 96}},
    {"first_name": "Sandra", "last_name": "Mitchell", "dob": "1980-11-04", "gender": "Female", "chief_complaint": "Kidney stone passed spontaneously, pain resolved completely, urine straining completed", "medical_history": ["Recurrent kidney stones"], "allergies": ["Sulfa drugs"], "medications": ["Tamsulosin 0.4mg"], "vitals": {"heart_rate": 72, "bp_sys": 118, "bp_dia": 74, "temp": 36.8, "rr": 14, "spo2": 99}},
    {"first_name": "Raymond", "last_name": "Perez", "dob": "1943-07-22", "gender": "Male", "chief_complaint": "Lower leg cellulitis significantly improved after 6 hours IV vancomycin, transitioning to oral antibiotics", "medical_history": ["Type 2 Diabetes", "Peripheral Vascular Disease"], "allergies": ["Penicillin"], "medications": ["Vancomycin IV", "Metformin 1000mg"], "vitals": {"heart_rate": 76, "bp_sys": 138, "bp_dia": 82, "temp": 37.4, "rr": 14, "spo2": 97}},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select, func

        # Skip if already seeded
        result = await db.execute(select(func.count(User.id)))
        if result.scalar() > 0:
            print("Database already seeded, skipping.")
            return

        # Default users
        for u in [
            {"email": "admin@hospital.com", "password": "admin123", "role": "admin", "first_name": "Sarah", "last_name": "Chen"},
            {"email": "nurse@hospital.com", "password": "nurse123", "role": "nurse", "first_name": "Marcus", "last_name": "Thompson"},
            {"email": "patient@hospital.com", "password": "patient123", "role": "patient", "first_name": "Demo", "last_name": "Patient"},
        ]:
            db.add(User(
                email=u["email"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
                first_name=u["first_name"],
                last_name=u["last_name"],
            ))
        await db.commit()

        # Staff
        for s in STAFF:
            db.add(Staff(**s, department="Emergency Department"))
        await db.commit()

        # Intake patients (no vitals)
        for i, p in enumerate(PATIENTS_INTAKE):
            intake = {
                "medical_history": p["medical_history"],
                "allergies": p["allergies"],
                "current_medications": p["medications"],
                "next_of_kin": {"name": "Family Contact", "phone": "555-0100"},
                "insurance": {"provider": "BlueCross", "member_id": f"BC{1000 + i}"},
                "consent_signed": True,
            }
            db.add(Patient(
                first_name=p["first_name"],
                last_name=p["last_name"],
                date_of_birth=p["dob"],
                gender=p["gender"],
                chief_complaint=p["chief_complaint"],
                stage="intake",
                stage_order=i,
                intake_data=intake,
            ))
        await db.commit()

        # Vitals patients
        for i, p in enumerate(PATIENTS_VITALS):
            intake = {
                "medical_history": p["medical_history"],
                "allergies": p["allergies"],
                "current_medications": p["medications"],
                "next_of_kin": {"name": "Family Contact", "phone": "555-0200"},
                "insurance": {"provider": "Aetna", "member_id": f"AE{2000 + i}"},
                "consent_signed": True,
            }
            patient = Patient(
                first_name=p["first_name"],
                last_name=p["last_name"],
                date_of_birth=p["dob"],
                gender=p["gender"],
                chief_complaint=p["chief_complaint"],
                stage="vitals",
                stage_order=i,
                intake_data=intake,
            )
            db.add(patient)
            await db.flush()

            v = p["vitals"]
            db.add(Vitals(
                patient_id=patient.id,
                heart_rate=v["heart_rate"],
                blood_pressure_systolic=v["bp_sys"],
                blood_pressure_diastolic=v["bp_dia"],
                temperature=v["temp"],
                respiratory_rate=v["rr"],
                oxygen_saturation=v["spo2"],
            ))
        await db.commit()

        # Doc visit patients
        for i, p in enumerate(PATIENTS_DOC_VISIT):
            intake = {
                "medical_history": p["medical_history"],
                "allergies": p["allergies"],
                "current_medications": p["medications"],
                "next_of_kin": {"name": "Family Contact", "phone": "555-0300"},
                "insurance": {"provider": "United", "member_id": f"UH{3000 + i}"},
                "consent_signed": True,
            }
            patient = Patient(
                first_name=p["first_name"],
                last_name=p["last_name"],
                date_of_birth=p["dob"],
                gender=p["gender"],
                chief_complaint=p["chief_complaint"],
                stage="doc_visit",
                stage_order=i,
                intake_data=intake,
            )
            db.add(patient)
            await db.flush()

            v = p["vitals"]
            db.add(Vitals(
                patient_id=patient.id,
                heart_rate=v["heart_rate"],
                blood_pressure_systolic=v["bp_sys"],
                blood_pressure_diastolic=v["bp_dia"],
                temperature=v["temp"],
                respiratory_rate=v["rr"],
                oxygen_saturation=v["spo2"],
            ))
        await db.commit()

        # Post-visit patients
        for i, p in enumerate(PATIENTS_POST_VISIT):
            intake = {
                "medical_history": p["medical_history"],
                "allergies": p["allergies"],
                "current_medications": p["medications"],
                "next_of_kin": {"name": "Family Contact", "phone": "555-0400"},
                "insurance": {"provider": "Medicare", "member_id": f"MC{4000 + i}"},
                "consent_signed": True,
            }
            patient = Patient(
                first_name=p["first_name"],
                last_name=p["last_name"],
                date_of_birth=p["dob"],
                gender=p["gender"],
                chief_complaint=p["chief_complaint"],
                stage="post_visit",
                stage_order=i,
                intake_data=intake,
            )
            db.add(patient)
            await db.flush()

            v = p["vitals"]
            db.add(Vitals(
                patient_id=patient.id,
                heart_rate=v["heart_rate"],
                blood_pressure_systolic=v["bp_sys"],
                blood_pressure_diastolic=v["bp_dia"],
                temperature=v["temp"],
                respiratory_rate=v["rr"],
                oxygen_saturation=v["spo2"],
            ))
        await db.commit()

        print("Seeded: 3 users, 12 staff, 39 patients (20/10/5/4 across stages)")


if __name__ == "__main__":
    asyncio.run(seed())

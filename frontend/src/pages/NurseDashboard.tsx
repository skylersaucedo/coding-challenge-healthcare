import Navbar from "@/components/Navbar";
import KanbanBoard from "@/components/KanbanBoard";

export default function NurseDashboard() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Navbar />
      <main className="flex-1 overflow-hidden">
        <KanbanBoard />
      </main>
    </div>
  );
}

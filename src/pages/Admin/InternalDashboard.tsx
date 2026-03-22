import { useParams } from "react-router-dom";
import DashboardContent from "../../components/dashboard/DashboardContent";

export default function InternalDashboard() {
  const { id } = useParams();

  if (!id) return null;

  return (
    <div className="space-y-6">
      <DashboardContent clienteId={id} isInternal={true} />
    </div>
  );
}

import { ChargersList } from "@/components/admin/inventory/ChargersList";

const AdminChargers = () => {
  const handleTabSwitch = (tab: string) => {
    // Navigation handled by the component internally
    console.log(`Navigating to tab: ${tab}`);
  };

  return (
    <div className="space-y-6">
      <ChargersList onSwitchTab={handleTabSwitch} />
    </div>
  );
};

export default AdminChargers;
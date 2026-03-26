import SideNavBar from "@/components/SideNavBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen font-body text-on-surface">
      <SideNavBar />
      
      {/* Background Decorative Elements shared across dashboard */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="fixed bottom-[-20%] left-[-5%] w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[150px] -z-10 pointer-events-none"></div>
      <div className="fixed top-[20%] left-[20%] w-[300px] h-[300px] bg-error/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      {children}
    </div>
  );
}

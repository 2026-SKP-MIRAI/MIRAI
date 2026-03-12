import Sidebar from "@/components/Sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F8F9FB]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}

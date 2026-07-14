"use client";

import { useAuth } from "@/providers/auth-provider";
import { useTranslation } from "@/providers/translation-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Users, TrendingUp, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { Loader2 } from "lucide-react";

// Revenue data will be dynamically loaded
export default function DashboardPage() {
  const { profile } = useAuth();
  const { dict } = useTranslation();
  const userName = profile?.full_name?.split(" ")[0] || "User";
  
  const [stats, setStats] = useState({ activeProjects: 0, totalClients: 0, completedPresentations: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      // Active Projects count
      const { count: activeProjectsCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("completed","archived","cancelled")');
        
      // Completed Projects count
      const { count: completedProjectsCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
        
      // Unique clients from projects
      const { data: projectsData } = await supabase.from('projects').select('client_name');
      const uniqueClients = new Set(projectsData?.map(p => p.client_name).filter(Boolean));
      
      setStats({
        activeProjects: activeProjectsCount || 0,
        totalClients: uniqueClients.size,
        completedPresentations: completedProjectsCount || 0
      });
      
      // Recent Activity
      const { data: logs } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (logs) setRecentActivity(logs);
      
      // Revenue / Budget Data (last 6 months)
      const { data: projectsBudgets } = await supabase
        .from('projects')
        .select('created_at, estimated_budget');

      if (projectsBudgets) {
        const last6Months = Array.from({ length: 6 }, (_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() - (5 - i));
          return {
            name: format(d, 'MMM'),
            month: d.getMonth(),
            year: d.getFullYear(),
            revenue: 0
          };
        });

        projectsBudgets.forEach(p => {
          if (!p.estimated_budget) return;
          const date = new Date(p.created_at);
          const monthIndex = last6Months.findIndex(m => m.month === date.getMonth() && m.year === date.getFullYear());
          if (monthIndex !== -1 && last6Months[monthIndex]) {
            last6Months[monthIndex].revenue += Number(p.estimated_budget);
          }
        });
        
        setRevenueData(last6Months);
      }
      
      setIsLoading(false);
    }
    
    fetchData();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-3xl font-light tracking-tight mb-2">{dict.dashboard?.welcomeBack || "Welcome back,"} {userName}</h2>
        <p className="text-muted-foreground">{dict.dashboard?.overviewDesc || "Here is an overview of your active projects and client interactions."}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{dict.dashboard?.activeProjects || "Active Projects"}</CardTitle>
            <FolderKanban className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
              <>
                <div className="text-3xl font-light">{stats.activeProjects}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 text-green-500">
                  <TrendingUp className="w-3 h-3" /> {dict.dashboard?.updatedJustNow || "Updated just now"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-card shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{dict.dashboard?.totalClients || "Total Clients"}</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
              <>
                <div className="text-3xl font-light">{stats.totalClients}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 text-green-500">
                  <TrendingUp className="w-3 h-3" /> {dict.dashboard?.updatedJustNow || "Updated just now"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{dict.dashboard?.completedProjects || "Completed Projects"}</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
              <>
                <div className="text-3xl font-light">{stats.completedPresentations}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 text-green-500">
                   <TrendingUp className="w-3 h-3" /> {dict.dashboard?.updatedJustNow || "Updated just now"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts */}
        <Card className="col-span-1 lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-medium">{dict.dashboard?.revenueOverview || "Revenue Overview"}</CardTitle>
            <CardDescription>{dict.dashboard?.revenueDesc || "Monthly recurring and project-based revenue"}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <BarChart data={revenueData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => `$${Number(value).toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-medium">{dict.dashboard?.recentActivity || "Recent Activity"}</CardTitle>
            <CardDescription>{dict.dashboard?.recentActivityDesc || "Latest updates across your projects"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {dict.dashboard?.noActivity || "No activity found yet."}
                </div>
              ) : (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex gap-4">
                    <div className="relative mt-1 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${activity.level === 'error' ? 'bg-destructive ring-destructive/20' : 'bg-primary ring-primary/20'} ring-4`} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </motion.div>
  );
}

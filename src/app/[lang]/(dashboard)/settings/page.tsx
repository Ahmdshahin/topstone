import { getDictionary } from "@/lib/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Terminal } from "lucide-react";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  
  const supabase = await createClient();
  
  // Fetch latest 50 logs
  const { data: logs } = await supabase
    .from('system_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const getLevelColor = (level: string) => {
    switch(level) {
      case 'error': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'warn': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'info': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'debug': return 'bg-secondary text-muted-foreground border-border';
      default: return 'bg-secondary text-foreground';
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {lang === 'ar' ? 'سجلات النظام' : 'System Logs'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lang === "ar" 
              ? "مراقبة الأخطاء وأحداث النظام الحية." 
              : "Monitor live system events and errors."}
          </p>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="bg-secondary/20 border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            {lang === 'ar' ? 'سجل الأحداث (آخر 50)' : 'Event Stream (Last 50)'}
          </CardTitle>
          <CardDescription>
            {lang === 'ar' 
              ? 'يتم تسجيل جميع الأخطاء والأحداث الهامة هنا تلقائياً.'
              : 'All critical errors and events are automatically recorded here.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/10">
                <TableRow>
                  <TableHead className="w-[150px]">{lang === 'ar' ? 'التاريخ' : 'Timestamp'}</TableHead>
                  <TableHead className="w-[100px]">{lang === 'ar' ? 'المستوى' : 'Level'}</TableHead>
                  <TableHead>{lang === 'ar' ? 'الرسالة' : 'Message'}</TableHead>
                  <TableHead className="w-[300px]">{lang === 'ar' ? 'البيانات' : 'Metadata'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!logs || logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      {lang === 'ar' ? 'لا توجد سجلات بعد.' : 'No logs recorded yet.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-secondary/5 border-b border-border/50">
                      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${getLevelColor(log.level)} uppercase text-[10px] tracking-wider`}>
                          {log.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {log.message}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground break-all">
                        {log.metadata && Object.keys(log.metadata).length > 0 
                          ? JSON.stringify(log.metadata)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const REPORT_TYPES = [
  { value: "PAYMENT_DETAILS_REPORT", label: "Payment Details", maxDays: 30 },
  { value: "ORDERS_AND_ITEMS_REPORT", label: "Orders and Items", maxDays: 15 },
  { value: "FINANCE_SUMMARY_REPORT", label: "Finance Summary", maxDays: 30 },
  { value: "ORDER_HISTORY_REPORT", label: "Order History", lookback: "T-188 to T-2" },
  { value: "ORDER_ERRORS_MENU_ITEM_REPORT", label: "Order Errors (Menu)", lookback: "T-188 to T-2" },
  { value: "ORDER_ERRORS_TRANSACTION_REPORT", label: "Order Errors (Transaction)", lookback: "T-190 to T-4" },
  { value: "DOWNTIME_REPORT", label: "Downtime", lookback: "T-188 to T-2" },
  { value: "CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT", label: "Customer Feedback", lookback: "T-188 to T-2" },
  { value: "MENU_ITEM_FEEDBACK_REPORT", label: "Menu Item Feedback", lookback: "T-188 to T-2" },
  { value: "BILLING_DETAILS_REPORT", label: "Billing Details", lookback: "T-1825 to T-2" },
];

export default function Reports() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [reportType, setReportType] = useState("PAYMENT_DETAILS_REPORT");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchRestaurants();
    fetchReports();
    
    // Poll for report updates every 30 seconds
    const interval = setInterval(fetchReports, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, uber_store_id')
      .eq('is_active', true)
      .not('uber_store_id', 'is', null);

    if (!error && data) {
      setRestaurants(data);
    }
  };

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReports(data);
    }
  };

  const handleCreateReport = async () => {
    if (!selectedRestaurant || !reportType || !startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("uber-create-report", {
        body: {
          restaurantId: selectedRestaurant,
          reportType,
          startDate,
          endDate,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Report requested successfully. Workflow ID: ${data.workflow_id}`,
      });

      // Refresh reports list
      fetchReports();
      
      // Reset form
      setSelectedRestaurant("");
      setStartDate("");
      setEndDate("");
    } catch (error: any) {
      console.error("Create report error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />{status}</Badge>;
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Generate and download Uber Eats reports</p>
        </div>

        {/* Create Report Card */}
        <Card>
          <CardHeader>
            <CardTitle>Create New Report</CardTitle>
            <CardDescription>
              Request a report from Uber Eats. Reports are generated asynchronously and will appear below when ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="restaurant">Restaurant</Label>
                <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
                  <SelectTrigger id="restaurant">
                    <SelectValue placeholder="Select restaurant" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurants.map((restaurant) => (
                      <SelectItem key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportType">Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger id="reportType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                        {type.maxDays && ` (Max ${type.maxDays} days)`}
                        {type.lookback && ` (${type.lookback})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={handleCreateReport} disabled={loading} className="w-full">
              <FileText className="mr-2 h-4 w-4" />
              {loading ? "Creating Report..." : "Create Report"}
            </Button>
          </CardContent>
        </Card>

        {/* Reports List */}
        <Card>
          <CardHeader>
            <CardTitle>Report History</CardTitle>
            <CardDescription>View and download generated reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No reports yet. Create your first report above.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        {REPORT_TYPES.find(t => t.value === report.report_type)?.label || report.report_type}
                      </TableCell>
                      <TableCell>
                        {format(new Date(report.start_date), 'MMM d')} - {format(new Date(report.end_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell>{format(new Date(report.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                      <TableCell>
                        {report.status === 'completed' && report.sections && (
                          <div className="space-x-2">
                            {report.sections.map((section: any, idx: number) => (
                              <Button
                                key={idx}
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(
                                  section.download_url,
                                  `report-${report.report_type}-${idx}.csv`
                                )}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download {idx + 1}
                              </Button>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Search, Plus, Mail, Phone, Edit, Trash2, Loader2, Users, MoreHorizontal } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "@/providers/translation-provider";
import { useAuth } from "@/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export default function ClientsPage() {
  const { dict } = useTranslation();
  const { user } = useAuth();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: ""
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error("Error fetching clients:", error);
      } else if (data) {
        setClients(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    
    setIsSaving(true);
    try {
      const supabase = createClient();
      
      if (editingClient) {
        const { data, error } = await supabase
          .from('clients')
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null
          })
          .eq('id', editingClient.id)
          .select()
          .single();
          
        if (error) throw error;
        setClients(clients.map(c => c.id === data.id ? data : c));
      } else {
        const { data, error } = await supabase
          .from('clients')
          .insert({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            created_by: user?.id
          })
          .select()
          .single();
          
        if (error) throw error;
        setClients([data, ...clients]);
      }
      
      setFormData({ name: "", email: "", phone: "" });
      setEditingClient(null);
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error("Failed to save client", error);
      alert(`Failed to save client.\n\nDatabase Error: ${error?.message || JSON.stringify(error)}\n\nPlease ensure you have run the Database SQL script in database_setup.md.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || "",
      phone: client.phone || ""
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client?")) return;
    
    try {
      const supabase = createClient();
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      
      setClients(clients.filter(c => c.id !== id));
    } catch (error: any) {
      console.error(error);
      alert("Failed to delete client: " + error.message);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight">{dict.clients?.title || "Clients"}</h1>
          <p className="text-muted-foreground mt-1">{dict.clients?.description || "Manage your clients and their contact information."}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingClient(null);
            setFormData({ name: "", email: "", phone: "" });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20" onClick={() => {
              setEditingClient(null);
              setFormData({ name: "", email: "", phone: "" });
            }}>
              <Plus className="w-4 h-4 mr-2" />
              {dict.clients?.newClient || "New Client"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateOrUpdateClient}>
              <DialogHeader>
                <DialogTitle>{editingClient ? dict.clients?.editClient || "Edit Client" : dict.clients?.addNewClient || "Add New Client"}</DialogTitle>
                <DialogDescription>
                  {editingClient ? dict.clients?.updateClientDesc || "Update the client\'s details below." : dict.clients?.addClientDesc || "Enter the client\'s details. They can be assigned to projects later."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>{dict.clients?.fullName || "Full Name / Company"} <span className="text-destructive">*</span></Label>
                  <Input 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="e.g. Shahin Al-Fayed"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{dict.clients?.emailAddress || "Email Address"}</Label>
                  <Input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    placeholder="client@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{dict.clients?.phoneNumber || "Phone Number"}</Label>
                  <Input 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSaving || !formData.name}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {editingClient ? "Save Changes" : "Save Client"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border shadow-sm">
        <div className="p-4 border-b border-border flex gap-4 bg-secondary/20">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={dict.clients?.searchClients || "Search clients..."} 
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading clients...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground">No clients found</h3>
            <p className="text-muted-foreground mt-1">Get started by creating your first client.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredClients.map((client, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                key={client.id} 
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/30 transition-colors"
              >
                <div>
                  <h4 className="font-medium text-foreground">{client.name}</h4>
                  <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                    {client.email && (
                      <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {client.email}</span>
                    )}
                    {client.phone && (
                      <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {client.phone}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(client)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Client
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDeleteClient(client.id)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Client
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

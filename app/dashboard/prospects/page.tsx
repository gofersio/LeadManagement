"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProspectForm } from "@/components/prospects/prospect-form";
import { CsvImportDialog } from "@/components/prospects/csv-import-dialog";
import type { Prospect } from "@prisma/client";

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    const res = await fetch("/api/prospects");
    const data = await res.json();
    setProspects(data.prospects ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(data: Record<string, string>) {
    const res = await fetch("/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to create lead");
      return;
    }
    toast.success("Lead added");
    setOpen(false);
    load();
  }

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      <PageHeader
        title="Leads"
        subtitle="Manage your prospect list"
        actions={
          <>
            <CsvImportDialog onImported={load} />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add Lead</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Lead</DialogTitle>
                </DialogHeader>
                <ProspectForm onSubmit={handleCreate} />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="bg-surface-container-lowest border border-outline-variant rounded overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : prospects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-on-surface-variant">
                  No leads yet. Add your first lead to get started.
                </TableCell>
              </TableRow>
            ) : (
              prospects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold">
                    {p.firstName} {p.lastName}
                  </TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{p.company ?? "—"}</TableCell>
                  <TableCell>{p.title ?? "—"}</TableCell>
                  <TableCell>{p.source}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.status.toUpperCase()}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

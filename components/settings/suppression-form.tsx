"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SuppressionForm() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/suppression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, reason, source: "manual" }),
    });
    if (res.ok) {
      toast.success("Email added to suppression list");
      setEmail("");
      setReason("");
    } else {
      toast.error("Failed to add email");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
      <div className="space-y-1 flex-1 min-w-[200px]">
        <Label htmlFor="sup-email">Email</Label>
        <Input
          id="sup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1 flex-1 min-w-[200px]">
        <Label htmlFor="sup-reason">Reason</Label>
        <Input
          id="sup-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="optional"
        />
      </div>
      <Button type="submit">Add</Button>
    </form>
  );
}

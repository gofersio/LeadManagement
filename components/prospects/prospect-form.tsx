"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProspectFormProps {
  onSubmit: (data: Record<string, string>) => void;
}

export function ProspectForm({ onSubmit }: ProspectFormProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit(Object.fromEntries(fd.entries()) as Record<string, string>);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input id="firstName" name="firstName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input id="lastName" name="lastName" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="linkedInUrl">LinkedIn URL</Label>
        <Input id="linkedInUrl" name="linkedInUrl" type="url" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="source">Source</Label>
        <Input id="source" name="source" placeholder="e.g. manual, linkedin, referral" required />
      </div>
      <Button type="submit" className="w-full">
        Save Lead
      </Button>
    </form>
  );
}

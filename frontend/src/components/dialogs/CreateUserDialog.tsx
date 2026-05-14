"use client";

import { useState, useEffect } from "react";
import { Plus, RefreshCw, Copy, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getRoleNames, inviteUser } from "@/lib/api";
import { RoleName } from "@/lib/types";
import { generateRandomPassword, validatePassword } from "@/lib/utils";
import { usePropertyStore } from "@/lib/store";
import { Checkbox } from "@/components/ui/checkbox";

const inviteUserSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  roleId: z.string().min(1, { message: "Please select a role" }),
  password: z.string().superRefine((val, ctx) => {
    const result = validatePassword(val);
    if (!result.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message,
      });
    }
  }),
  sendEmail: z.boolean(),
  rank: z.coerce.number(),
});

type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

interface CreateUserDialogProps {
  onUserCreated: () => void;
}

export function CreateUserDialog({ onUserCreated }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const { selectedProperty } = usePropertyStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
    watch,
  } = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      roleId: "",
      password: generateRandomPassword(14),
      sendEmail: true,
      rank: 0,
    },
  });

  const watchEmail = watch("email");
  const watchSendEmail = watch("sendEmail");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Password copied to clipboard");
  };

  // Load roles when dialog opens
  useEffect(() => {
    if (open) {
      loadRoles();
    }
  }, [open]);

  const loadRoles = async () => {
    setLoadingRoles(true);
    try {
      const response = await getRoleNames(selectedProperty?._id);
      setRoles(response.data);
    } catch (error) {
      console.error("Failed to load roles:", error);
      toast.error("Failed to load roles");
    } finally {
      setLoadingRoles(false);
    }
  };

  const onSubmit = async (data: InviteUserFormValues) => {
    setIsLoading(true);
    try {
      await inviteUser(data.email, [data.roleId], {
        password: data.password || undefined,
        sendEmail: data.sendEmail,
        rank: data.rank,
      });
      toast.success(data.sendEmail ? "Invitation Sent" : "User Created", {
        description: data.sendEmail
          ? `An invitation has been sent to ${data.email}`
          : `User ${data.email} has been created with the provided password.`,
      });
      reset();
      setOpen(false);
      onUserCreated();
    } catch (error: any) {
      toast.error("Failed to Send Invitation", {
        description: error.message || "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 w-8 rounded-full p-0">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] flex flex-col justify-center">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation to add a new user to your organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleId">Role</Label>
              <Select
                onValueChange={(value) => setValue("roleId", value)}
                disabled={loadingRoles}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingRoles ? "Loading roles..." : "Select a role"} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleId && (
                <p className="text-sm text-red-500">{errors.roleId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rank">Rank</Label>
              <Input
                id="rank"
                type="number"
                placeholder="0"
                {...register("rank", { valueAsNumber: true })}
              />
              {errors.rank && (
                <p className="text-sm text-red-500">{errors.rank.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Input
                  id="password"
                  type="text"
                  placeholder="Enter temporary password"
                  {...register("password")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-9 top-1 h-7 w-7 p-0"
                  onClick={() => copyToClipboard(watch("password"))}
                  title="Copy password"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={() => setValue("password", generateRandomPassword(14))}
                  title="Generate new password"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendEmail"
                  checked={watchSendEmail}
                  onCheckedChange={(checked) => setValue("sendEmail", checked as boolean)}
                />
                <Label htmlFor="sendEmail" className="text-sm font-medium leading-none cursor-pointer">
                  Send invitation email
                </Label>
              </div>

              {watchSendEmail ? (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    <span className="font-bold">Note:</span> User will get an invitation link. They can login by clicking on it.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    <span className="font-bold">Note:</span> User will not get invitation mail. Please share the email and password manually for login.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

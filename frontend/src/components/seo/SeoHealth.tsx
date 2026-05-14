"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSeoHealth } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Loader2 } from "lucide-react";

const StatusIcon = ({ status }: { status: "ok" | "warn" | "fail" | "error" | boolean }) => {
  if (status === "ok" || status === true) {
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  }
  if (status === "warn") {
    return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  }
  return <XCircle className="w-5 h-5 text-red-500" />;
};

export function SeoHealth() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["seoHealth"],
    queryFn: fetchSeoHealth,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SEO Health Check</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <Card><CardHeader><CardTitle>SEO Health Check</CardTitle></CardHeader><CardContent><p className="text-red-500">Error loading data</p></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO Health Check</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead>Large Image</TableHead>
              <TableHead>Schema</TableHead>
              <TableHead>Byline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.article}</TableCell>
                <TableCell><StatusIcon status={item.largeImage} /></TableCell>
                <TableCell><StatusIcon status={item.schema} /></TableCell>
                <TableCell><StatusIcon status={item.byline} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


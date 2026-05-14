"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAuditTrails } from "@/lib/api";
import { TablePagination } from "@/components/ui/table-pagination";
import { AuditEntity } from "@/lib/types";
import { useParams } from "next/navigation";
import { string } from "zod";
import React from "react";

interface PageProps {
  params: {
    id: string;
  };
}

export default function AuditTrailPage() {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AuditEntity[]>([]);
  const [total, setTotal] = useState(0);
  const params = useParams();
  const objectId = params.id as string;

  const fetchAuditForArticle = async () => {
    setLoading(true);
    try {
      const res = await getAuditTrails({
        page,
        limit,
        objectId: objectId,
        // collectionName: "category",
        sort: "createdAt",
        sortOrder: "desc",
      });

      setData(res.data);
      setTotal(res.total);
    } catch (error) {
      console.error("Failed to fetch audit trail", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditForArticle();
  }, [page, limit]);

  console.log(data);

  // const data = mockAuditData;

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
        return "text-green-700";
      case "update":
        return "text-orange-600";
      case "delete":
        return "text-red-700";
      default:
        return "text-gray-700";
    }
  };

  // const formatDate = (dateString: string) => {
  //   const date = new Date(dateString);
  //   const day = date.getDate().toString().padStart(2, "0");
  //   const month = date.toLocaleString("en-US", { month: "short" });
  //   const year = date.getFullYear();
  //   return `${day} ${month} ${year}`;
  // };


  //Formatting time 
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toTimeString().slice(0, 8);
  };

  //capitalizing the first letter word
  const capitalize = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const formatValue = (value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") return "--";
    
    // Try to parse if it's a string that looks like JSON
    if (typeof value === "string" && (value.trim().startsWith("{") || value.trim().startsWith("["))) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((v: any) => v.name || v.title || JSON.stringify(v)).join(", ");
        }
        if (typeof parsed === "object" && parsed !== null) {
          return parsed.name || parsed.title || JSON.stringify(parsed);
        }
        return String(parsed);
      } catch (e) {
        // Not valid JSON, continue
      }
    }

    // Handle HTML content - show a preview or just the text
    if (typeof value === "string" && value.includes("<") && value.includes(">")) {
      try {
        const doc = new DOMParser().parseFromString(value, "text/html");
        return doc.body.textContent || value;
      } catch (e) {
        return value;
      }
    }

    return String(value);
  };


  return (
    <div className="min-h-screen p-8">
      <div className=" mx-auto">
        {/* Table Header */}
        <Table className="md:w-full md:table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Entity Id</TableHead>
              <TableHead>Collection</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="overflow-hidden">
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading audit trail data...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  No audit trail data found
                </TableCell>
              </TableRow>
            ) : (
              data.map((audit) => (
                <React.Fragment key={audit._id}>
                  {/* MAIN ROW */}
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleRow(audit._id)}
                          className=""
                        >
                          {expandedRows.has(audit._id) ? (
                            <ChevronDown size={18} />
                          ) : (
                            <ChevronRight size={18} />
                          )}
                        </button>
                        <span>
                          {audit.createdBy.userName || "--"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>{audit.objectId}</TableCell>

                    <TableCell>
                      {capitalize(audit.collectionName)}
                    </TableCell>

                    <TableCell
                      className={`font-semibold text-sm uppercase ${getActionColor(
                        audit.action
                      )}`}
                    >
                      {audit.action}
                    </TableCell>

                    <TableCell className="">
                      {formatTime(audit.updatedAt)}
                    </TableCell>
                  </TableRow>

                  {/* EXPANDED ROW */}
                  {expandedRows.has(audit._id) && audit.changes.length > 0 && (
                    <TableRow key={`${audit._id}-expanded`}>
                      <TableCell colSpan={5} className="p-0">
                        <div className="md:w-full md:overflow-x-auto">
                          <Table className="min-w-max">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Field name</TableHead>
                                <TableHead>Old value</TableHead>
                                <TableHead>New value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {audit.changes.map((change, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{change.fieldName}</TableCell>
                                  <TableCell>{formatValue(change.oldValue)}</TableCell>
                                  <TableCell>{formatValue(change.newValue)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
    </div>
  );
}

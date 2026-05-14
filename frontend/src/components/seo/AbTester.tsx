"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export function AbTester() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>A/B Test Headlines</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">{`Headline A: "Mumbai Rain Leads to Traffic Chaos"`}</span>
              <span className="text-sm font-medium">58% CTR</span>
            </div>
            <Progress value={58} />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">{`Headline B: "Monsoon Fury: Mumbai Grinds to a Halt"`}</span>
              <span className="text-sm font-medium">42% CTR</span>
            </div>
            <Progress value={42} />
          </div>
          <Button variant="secondary" className="w-full">Suggest more headlines with AI</Button>
        </div>
      </CardContent>
    </Card>
  );
}


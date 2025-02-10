"use client";

import { useEffect, useState } from "react";
// This is my favorite

export function FormMessage() {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<"success" | "error" | "message" | null>(
    null
  );
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("success")) {
      setType("success");
      setMessage(searchParams.get("success"));
      // window.history.replaceState({}, "", window.location.pathname);
    } else if (searchParams.get("error")) {
      setType("error");
      setMessage(searchParams.get("error"));
      // window.history.replaceState({}, "", window.location.pathname);
    } else if (searchParams.get("message")) {
      setType("message");
      setMessage(searchParams.get("message"));
      // window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="flex flex-col gap-2 w-full max-w-md text-sm">
      {type === "success" && (
        <div className="text-foreground border-l-2 border-foreground px-4">
          {message}
        </div>
      )}
      {type === "error" && (
        <div className="text-destructive-foreground border-l-2 border-destructive-foreground px-4">
          {message}
        </div>
      )}
      {type === "message" && (
        <div className="text-foreground border-l-2 px-4">{message}</div>
      )}
    </div>
  );
}

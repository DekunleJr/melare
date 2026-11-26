"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import type { Access } from "@/features/access";
import { customerReschedule, fetchRescheduleSlots } from "@/features/bookings/actions";
import { SlotPicker } from "./slot-picker";

export function ReschedulePanel({
  access,
  window,
}: {
  access: Access;
  window: { firstDay: string; lastDay: string };
}) {
  const [start, setStart] = useState("");
  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">Move to another time</summary>
      <div className="mt-4">
        <SlotPicker
          window={window}
          value={start}
          onChange={setStart}
          load={(key) => fetchRescheduleSlots(access, key)}
        />
        <ActionForm action={customerReschedule.bind(null, access)} className="mt-4 space-y-3">
          <input type="hidden" name="start" value={start} />
          <SubmitButton disabled={!start}>Confirm new time</SubmitButton>
        </ActionForm>
      </div>
    </details>
  );
}

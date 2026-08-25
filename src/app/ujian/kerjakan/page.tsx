import { Suspense } from "react";
import KerjakanClient from "./KerjakanClient";

export default function KerjakanPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <KerjakanClient />
    </Suspense>
  );
}

import { Suspense } from "react";
import HasilClient from "./HasilClient";

export default function HasilPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <HasilClient />
    </Suspense>
  );
}

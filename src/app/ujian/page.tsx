import { Suspense } from "react";
import UjianEntryForm from "./UjianEntryForm";

export default function UjianPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <Suspense fallback={null}>
        <UjianEntryForm />
      </Suspense>
    </div>
  );
}

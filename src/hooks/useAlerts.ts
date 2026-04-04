// src/hooks/useAlerts.ts

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, DocumentData, orderBy } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export interface AlertCase extends DocumentData {
  id: string;
  name: string;
  age: number;
  gender: string;
  lastSeenLocation: string;
  lastSeenLat: number | null;
  lastSeenLng: number | null;
  photoUrl?: string;
  isUrgentFlag?: boolean;
  isVulnerable?: boolean;
  status: string;
  verified: boolean;
  createdAt: any;
}

/**
 * Subscribes to all active, verified missing person cases.
 * Used by the Alerts page to display the full alert list.
 */
export function useAlerts() {
  const [alerts, setAlerts]   = useState<AlertCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "missingPersons"),
      where("status", "==", "active"),
      where("verified", "==", true),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: AlertCase[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as AlertCase[];
        setAlerts(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useAlerts snapshot error:", err);
        // Common cause: missing Firestore composite index.
        // Visit the URL in the error message to create it.
        setError("Failed to load alerts. Check Firestore indexes.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { alerts, loading, error };
}
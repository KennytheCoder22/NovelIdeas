import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

export async function generateStaticParams() {
  return [{ libraryId: "test-library" }];
}


type HostedLibraryConfig = {
  libraryId?: string;
  branding?: {
    libraryName?: string;
  };
  error?: string;
};

export default function HostedLibraryScreen() {
  const { libraryId } = useLocalSearchParams<{ libraryId?: string }>();
  const libraryIdString = "test-library";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HostedLibraryConfig | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      if (!libraryIdString) {
        setError("Missing library ID.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/config/${encodeURIComponent(libraryIdString)}`);
        const json = (await res.json()) as HostedLibraryConfig;

        if (cancelled) return;

        if (!res.ok) {
          setData(null);
          setError(json?.error || "Failed to load library config.");
          setLoading(false);
          return;
        }

        setData(json);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setData(null);
        setError("Failed to load library config.");
        setLoading(false);
      }
    }

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, [libraryIdString]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0b1e33",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {loading ? (
        <>
          <Text style={{ color: "#e5efff", fontSize: 22, fontWeight: "900", marginBottom: 8 }}>
            Loading library...
          </Text>
          <Text style={{ color: "#cbd5f5", fontSize: 14, textAlign: "center" }}>
            Library ID: {libraryIdString}
          </Text>
        </>
      ) : error ? (
        <>
          <Text style={{ color: "#fecaca", fontSize: 22, fontWeight: "900", marginBottom: 8 }}>
            Could not load library
          </Text>
          <Text style={{ color: "#cbd5f5", fontSize: 14, textAlign: "center", marginBottom: 6 }}>
            Library ID: {libraryIdString}
          </Text>
          <Text style={{ color: "#cbd5f5", fontSize: 14, textAlign: "center" }}>{error}</Text>
        </>
      ) : (
        <>
          <Text style={{ color: "#e5efff", fontSize: 22, fontWeight: "900", marginBottom: 8 }}>
            Library loaded
          </Text>
          <Text style={{ color: "#cbd5f5", fontSize: 14, textAlign: "center", marginBottom: 6 }}>
            Library ID: {data?.libraryId || libraryIdString}
          </Text>
          <Text style={{ color: "#cbd5f5", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
            {data?.branding?.libraryName || "Unnamed library"}
          </Text>
        </>
      )}
    </View>
  );
}
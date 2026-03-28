import React from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function HostedLibraryScreen() {
  const { libraryId } = useLocalSearchParams<{ libraryId?: string }>();

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
      <Text style={{ color: "#e5efff", fontSize: 22, fontWeight: "900", marginBottom: 8 }}>
        Loading library...
      </Text>
      <Text style={{ color: "#cbd5f5", fontSize: 14, textAlign: "center" }}>
        Library ID: {String(libraryId || "")}
      </Text>
    </View>
  );
}
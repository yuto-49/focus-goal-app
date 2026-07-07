import { StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { LocationPing } from "../lib/types";

type Props = {
  pings: LocationPing[];
  height?: number;
};

export function LiveMap({ pings, height = 200 }: Props) {
  if (pings.length === 0) {
    return (
      <MapView
        style={[styles.map, { height }]}
        initialRegion={{
          latitude: 35.6762,
          longitude: 139.6503,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      />
    );
  }

  const latestPing = pings[pings.length - 1];
  const coordinates = pings.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  return (
    <MapView
      style={[styles.map, { height }]}
      region={{
        latitude: latestPing.lat,
        longitude: latestPing.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }}
    >
      {coordinates.length > 1 && (
        <Polyline
          coordinates={coordinates}
          strokeColor="#000"
          strokeWidth={3}
        />
      )}
      <Marker
        coordinate={{
          latitude: latestPing.lat,
          longitude: latestPing.lng,
        }}
        title="Current Location"
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
});

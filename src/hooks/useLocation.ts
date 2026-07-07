import { useEffect, useRef, useState } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import Geolocation from "@react-native-community/geolocation";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../stores/appStore";

type UseLocationOptions = {
  goalId: string | undefined;
  enabled: boolean;
};

export function useLocation({ goalId, enabled }: UseLocationOptions) {
  const [hasPermission, setHasPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const { addLocationPing } = useAppStore();

  useEffect(() => {
    if (!enabled) return;

    const requestPermission = async () => {
      if (Platform.OS === "ios") {
        Geolocation.requestAuthorization("whenInUse");
        setHasPermission(true);
        return;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
    };

    requestPermission();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !hasPermission || !goalId) return;

    const startTracking = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      watchIdRef.current = Geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setCurrentLocation({ lat, lng });

          const { data, error } = await supabase
            .from("location_pings")
            .insert({
              goal_id: goalId,
              user_id: user.id,
              lat,
              lng,
            })
            .select()
            .single();

          if (data && !error) {
            addLocationPing(data);
          }
        },
        () => {
          setHasPermission(false);
        },
        {
          enableHighAccuracy: false,
          distanceFilter: 20,
          interval: 15000,
          fastestInterval: 10000,
        }
      );
    };

    startTracking();

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, hasPermission, goalId]);

  return { hasPermission, currentLocation };
}

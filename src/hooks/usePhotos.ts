import { useEffect, useCallback, useState } from "react";
import { launchImageLibrary, launchCamera } from "react-native-image-picker";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../stores/appStore";
import type { GoalPhoto } from "../lib/types";

export function usePhotos(goalId: string | undefined) {
  const { photos, setPhotos, addPhoto } = useAppStore();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!goalId) return;

    const load = async () => {
      const { data } = await supabase
        .from("goal_photos")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: true });

      if (data) setPhotos(data as GoalPhoto[]);
    };

    load();
  }, [goalId]);

  useEffect(() => {
    if (!goalId) return;

    const channel = supabase
      .channel(`goal:${goalId}:photos`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "goal_photos",
          filter: `goal_id=eq.${goalId}`,
        },
        (payload) => {
          const newPhoto = payload.new as GoalPhoto;
          addPhoto(newPhoto);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [goalId]);

  const uploadAsset = useCallback(
    async (uri: string, type: string | undefined, caption: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = uri.split(".").pop() || "jpg";
      const fileName = `${goalId}/${Date.now()}.${fileExt}`;

      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("goal-photos")
        .upload(fileName, arrayBuffer, {
          contentType: type || "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("goal-photos").getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from("goal_photos")
        .insert({
          goal_id: goalId,
          user_id: user.id,
          image_url: publicUrl,
          caption,
        });

      if (insertError) throw insertError;
    },
    [goalId]
  );

  const pickAndUpload = useCallback(
    async (caption: string) => {
      if (!goalId) return;

      const result = await launchImageLibrary({
        mediaType: "photo",
        quality: 0.7,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      setUploading(true);
      try {
        const asset = result.assets[0];
        if (!asset.uri) return;
        await uploadAsset(asset.uri, asset.type, caption);
      } finally {
        setUploading(false);
      }
    },
    [goalId, uploadAsset]
  );

  const takeAndUpload = useCallback(
    async (caption: string) => {
      if (!goalId) return;

      const result = await launchCamera({
        mediaType: "photo",
        quality: 0.7,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      setUploading(true);
      try {
        const asset = result.assets[0];
        if (!asset.uri) return;
        await uploadAsset(asset.uri, asset.type, caption);
      } finally {
        setUploading(false);
      }
    },
    [goalId, uploadAsset]
  );

  return { photos, uploading, pickAndUpload, takeAndUpload };
}

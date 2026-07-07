import { View, Text, Image, StyleSheet, Dimensions } from "react-native";
import type { GoalPhoto } from "../lib/types";

type Props = {
  photos: GoalPhoto[];
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - 8) / 3;

export function PhotoGrid({ photos }: Props) {
  if (photos.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Photos ({photos.length})</Text>
      <View style={styles.grid}>
        {photos.map((photo) => (
          <View key={photo.id} style={styles.photoWrapper}>
            <Image
              source={{ uri: photo.image_url }}
              style={styles.photo}
              resizeMode="cover"
            />
            {photo.caption ? (
              <Text style={styles.caption} numberOfLines={1}>
                {photo.caption}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#555" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  photoWrapper: { width: PHOTO_SIZE },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
  },
  caption: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
});

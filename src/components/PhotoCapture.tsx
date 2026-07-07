import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";

type Props = {
  uploading: boolean;
  onPickFromGallery: (caption: string) => Promise<void>;
  onTakePhoto: (caption: string) => Promise<void>;
};

export function PhotoCapture({ uploading, onPickFromGallery, onTakePhoto }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [caption, setCaption] = useState("");

  const handlePick = async () => {
    await onPickFromGallery(caption);
    setCaption("");
    setShowModal(false);
  };

  const handleCamera = async () => {
    await onTakePhoto(caption);
    setCaption("");
    setShowModal(false);
  };

  if (uploading) {
    return (
      <View style={styles.uploadingContainer}>
        <ActivityIndicator size="small" color="#000" />
        <Text style={styles.uploadingText}>Uploading...</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.photoButton}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.photoButtonText}>Add Photo</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add a Photo</Text>

            <TextInput
              style={styles.captionInput}
              placeholder="Caption (optional)"
              value={caption}
              onChangeText={setCaption}
            />

            <TouchableOpacity style={styles.modalButton} onPress={handleCamera}>
              <Text style={styles.modalButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalButton} onPress={handlePick}>
              <Text style={styles.modalButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setCaption("");
                setShowModal(false);
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  photoButton: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  photoButtonText: { fontSize: 14, fontWeight: "600", color: "#333" },
  uploadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 8,
  },
  uploadingText: { fontSize: 13, color: "#666" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  captionInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  modalButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cancelButton: {
    padding: 14,
    alignItems: "center",
  },
  cancelText: { fontSize: 15, color: "#888" },
});

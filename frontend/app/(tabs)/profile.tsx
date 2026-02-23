import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useAuthStore } from "../../store/authStore";
import { useLocationStore } from "../../store/locationStore";
import * as userService from "../../services/user";
import { Colors } from "../../constants/colors";

export default function ProfileScreen() {
  const { user, refreshUser, logout } = useAuthStore();
  const { city, requestPermission, updateLocation } = useLocationStore();

  const [username, setUsername] = useState(user?.username || "");
  const [interests, setInterests] = useState(
    user?.interests?.join(", ") || ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setInterests(user.interests?.join(", ") || "");
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const interestList = interests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await userService.updateProfile({
        username: username.trim(),
        interests: interestList,
      });
      await refreshUser();
      Alert.alert("Success", "Profile updated");
    } catch {
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLocation = async () => {
    const granted = await requestPermission();
    if (granted) {
      await updateLocation();
      await refreshUser();
      Alert.alert("Success", "Location updated");
    } else {
      Alert.alert(
        "Permission Required",
        "Location permission is needed to find matches near you"
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.username || "?").charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Your username"
          placeholderTextColor={Colors.textLight}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Interests</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={interests}
          onChangeText={setInterests}
          placeholder="Music, Travel, Coding..."
          placeholderTextColor={Colors.textLight}
          multiline
        />
        <Text style={styles.hint}>Separate with commas</Text>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Saving..." : "Save Changes"}
        </Text>
      </TouchableOpacity>

      <View style={styles.locationSection}>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.locationText}>
          {city || user?.city || "Not set"}
        </Text>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={handleUpdateLocation}
        >
          <Text style={styles.locationButtonText}>Update Location</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#fff",
  },
  email: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 6,
    marginLeft: 4,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 32,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  locationSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  locationText: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: "600",
    marginBottom: 12,
  },
  locationButton: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  locationButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  logoutButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#FFF0F0",
  },
  logoutText: {
    color: Colors.error,
    fontSize: 17,
    fontWeight: "600",
  },
});

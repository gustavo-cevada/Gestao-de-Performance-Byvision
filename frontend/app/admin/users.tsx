import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api/client";
import { Icon } from "@/src/components/icon";
import { LogoHeader } from "@/src/components/logo-header";
import { useToast } from "@/src/components/toast";
import { useAuth } from "@/src/context/auth";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

type Role = "admin" | "vendedor";
type UserRow = {
  id: string;
  username: string;
  nome: string | null;
  email: string | null;
  role: Role;
  cod_vendedor: number | null;
  disabled: boolean;
};
type UsersResp = { users: UserRow[] };

export default function AdminUsers() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<UsersResp>("/auth/users"),
    enabled: user?.role === "admin",
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  if (user?.role !== "admin") return <Redirect href="/dashboard" />;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(u: UserRow) {
    setEditing(u);
    setFormOpen(true);
  }

  return (
    <View style={styles.screen}>
      <LogoHeader title="Usuários" onBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={data?.users ?? []}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`user-row-${item.username}`}>
              <View style={[styles.avatar, item.disabled && { backgroundColor: colors.surfaceTertiary }]}>
                <Icon
                  name={item.role === "admin" ? "shield-account" : "account"}
                  size={22}
                  color={item.disabled ? colors.muted : colors.onBrandPrimary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.nome || item.username}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {`@${item.username} • ${item.role === "admin" ? "Administrador" : "Vendedor"}`}
                  {item.cod_vendedor != null ? ` • cod ${item.cod_vendedor}` : ""}
                </Text>
                {item.disabled && <Text style={styles.disabledTag}>DESATIVADO</Text>}
              </View>
              <Pressable style={styles.iconBtn} onPress={() => setResetting(item)} testID={`reset-${item.username}`}>
                <Icon name="lock-reset" size={20} color={colors.muted} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => openEdit(item)} testID={`edit-${item.username}`}>
                <Icon name="pencil-outline" size={20} color={colors.brand} />
              </Pressable>
            </View>
          )}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          testID="admin-users-list"
        />
      )}

      <Pressable style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={openCreate} testID="add-user-fab">
        <Icon name="account-plus" size={22} color={colors.onBrandPrimary} />
        <Text style={styles.fabText}>Novo usuário</Text>
      </Pressable>

      <UserFormModal
        visible={formOpen}
        editing={editing}
        currentUsername={user?.username}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          refresh();
        }}
        onError={(m) => toast(m, "error")}
        onSuccess={(m) => toast(m, "success")}
      />

      <ResetModal
        user={resetting}
        onClose={() => setResetting(null)}
        onSuccess={(m) => {
          toast(m, "success");
          setResetting(null);
        }}
        onError={(m) => toast(m, "error")}
      />
    </View>
  );
}

function UserFormModal({
  visible,
  editing,
  currentUsername,
  onClose,
  onSaved,
  onError,
  onSuccess,
}: {
  visible: boolean;
  editing: UserRow | null;
  currentUsername?: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("vendedor");
  const [cod, setCod] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const isEdit = !!editing;
  const isSelf = editing?.username === currentUsername;

  function reset() {
    setUsername(editing?.username ?? "");
    setPassword("");
    setNome(editing?.nome ?? "");
    setEmail(editing?.email ?? "");
    setRole(editing?.role ?? "vendedor");
    setCod(editing?.cod_vendedor != null ? String(editing.cod_vendedor) : "");
    setDisabled(editing?.disabled ?? false);
  }

  async function submit() {
    if (!isEdit && (username.trim().length < 3 || password.length < 4)) {
      onError("Usuário (mín. 3) e senha (mín. 4) são obrigatórios.");
      return;
    }
    if (!nome.trim()) {
      onError("Informe o nome.");
      return;
    }
    setBusy(true);
    try {
      const codNum = cod.trim() ? parseInt(cod.trim(), 10) : null;
      if (isEdit) {
        await apiFetch(`/auth/users/${editing!.id}`, {
          method: "PATCH",
          body: { nome: nome.trim(), role, cod_vendedor: codNum, email: email.trim() || null, disabled },
        });
        onSuccess("Usuário atualizado");
      } else {
        await apiFetch("/auth/users", {
          method: "POST",
          body: {
            username: username.trim(),
            password,
            nome: nome.trim(),
            role,
            cod_vendedor: codNum,
            email: email.trim() || null,
          },
        });
        onSuccess("Usuário criado");
      }
      onSaved();
    } catch (e: any) {
      onError(e?.message || "Erro ao salvar usuário");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onShow={reset} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.formSheet, { paddingBottom: insets.bottom + 16 }]} testID="user-form-modal">
        <View style={styles.grabber} />
        <Text style={styles.formTitle}>{isEdit ? "Editar usuário" : "Novo usuário"}</Text>

        <KeyboardAwareScrollView bottomOffset={20} keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
          <View style={{ gap: 14, paddingBottom: 8 }}>
            {!isEdit && (
              <Field label="Usuário">
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  placeholder="ex.: joao"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  testID="user-username"
                />
              </Field>
            )}
            {!isEdit && (
              <Field label="Senha">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="mín. 4 caracteres"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  testID="user-password"
                />
              </Field>
            )}
            <Field label="Nome">
              <TextInput
                value={nome}
                onChangeText={setNome}
                placeholder="Nome completo"
                placeholderTextColor={colors.muted}
                style={styles.input}
                testID="user-nome"
              />
            </Field>
            <Field label="E-mail (opcional)">
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="email@empresa.com"
                placeholderTextColor={colors.muted}
                style={styles.input}
                testID="user-email"
              />
            </Field>
            <Field label="Cargo">
              <View style={styles.segment}>
                {(["vendedor", "admin"] as Role[]).map((r) => {
                  const active = role === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setRole(r)}
                      disabled={isSelf && r === "vendedor"}
                      style={[styles.segItem, active && { backgroundColor: colors.brandPrimary }, isSelf && r === "vendedor" && { opacity: 0.4 }]}
                      testID={`role-${r}`}
                    >
                      <Text style={[styles.segText, { color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary }]}>
                        {r === "admin" ? "Administrador" : "Vendedor"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>
            {role === "vendedor" && (
              <Field label="Cód. vendedor (DW)">
                <TextInput
                  value={cod}
                  onChangeText={(t) => setCod(t.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  placeholder="ex.: 204"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  testID="user-cod"
                />
              </Field>
            )}
            {isEdit && (
              <View style={styles.switchRow}>
                <Text style={styles.label}>Desativar acesso</Text>
                <Switch
                  value={disabled}
                  onValueChange={setDisabled}
                  disabled={isSelf}
                  trackColor={{ true: colors.error, false: colors.borderStrong }}
                  testID="user-disabled"
                />
              </View>
            )}
          </View>
        </KeyboardAwareScrollView>

        <Pressable style={[styles.primaryBtn, busy && { opacity: 0.7 }]} onPress={submit} disabled={busy} testID="user-save">
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Salvar</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}

function ResetModal({
  user,
  onClose,
  onSuccess,
  onError,
}: {
  user: UserRow | null;
  onClose: () => void;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pw.length < 4) {
      onError("A senha deve ter ao menos 4 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/auth/users/${user!.id}/reset-password`, { method: "POST", body: { new_password: pw } });
      setPw("");
      onSuccess("Senha redefinida");
    } catch (e: any) {
      onError(e?.message || "Erro ao redefinir senha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={!!user} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centerModalWrap} pointerEvents="box-none">
        <View style={[styles.centerModal, { marginBottom: insets.bottom }]} testID="reset-modal">
          <Text style={styles.formTitle}>Redefinir senha</Text>
          <Text style={styles.sub}>{user?.nome || user?.username}</Text>
          <TextInput
            value={pw}
            onChangeText={setPw}
            secureTextEntry
            placeholder="Nova senha (mín. 4)"
            placeholderTextColor={colors.muted}
            style={[styles.input, { marginTop: 12 }]}
            testID="reset-input"
          />
          <View style={styles.modalActions}>
            <Pressable style={styles.ghostBtn} onPress={onClose}>
              <Text style={styles.ghostText}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, { flex: 1 }, busy && { opacity: 0.7 }]} onPress={submit} disabled={busy} testID="reset-confirm">
              {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Redefinir</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, justifyContent: "center", alignItems: "center" },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: c.onSurface },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  disabledTag: { fontFamily: fonts.bold, fontSize: 10, color: c.error, marginTop: 3 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", backgroundColor: c.surfaceTertiary },

  fab: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.brandPrimary,
    paddingHorizontal: 20,
    height: 52,
    borderRadius: 26,
  },
  fabText: { fontFamily: fonts.bold, fontSize: 15, color: c.onBrandPrimary },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  formSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 4 },
  formTitle: { fontFamily: fonts.bold, fontSize: 18, color: c.onSurface },
  label: { fontFamily: fonts.medium, fontSize: 13, color: c.onSurfaceSecondary },
  input: {
    backgroundColor: c.surfaceTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
    height: 50,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: c.onSurface,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: 12, padding: 4, gap: 4 },
  segItem: { flex: 1, height: 42, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  segText: { fontFamily: fonts.semibold, fontSize: 13 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  primaryBtn: { backgroundColor: c.brandPrimary, height: 52, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  primaryText: { fontFamily: fonts.bold, fontSize: 16, color: c.onBrandPrimary },

  centerModalWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "center", padding: 24 },
  centerModal: { backgroundColor: c.surface, borderRadius: 18, padding: 20, gap: 4 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16, alignItems: "center" },
  ghostBtn: { paddingHorizontal: 18, height: 52, justifyContent: "center", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: c.border },
  ghostText: { fontFamily: fonts.semibold, fontSize: 15, color: c.onSurfaceSecondary },
}));

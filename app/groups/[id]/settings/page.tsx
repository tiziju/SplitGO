"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { ArrowLeft, Trash2, AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";

const GROUP_ICONS = [
  "✈️","🏖️","🗾","🗺️","🏔️","🎌","🌏","🚢","🚂","🏕️",
  "🍜","🍣","🍕","🥘","🍺","🥂","☕","🛍️","🎮","🎉",
  "👨‍👩‍👧‍👦","👫","👬","👭","🏠","💼","🎓","⚽","🎵","💰",
];

interface Member {
  id: string;
  userId: string;
  user: { id: string; displayName: string; avatarUrl?: string | null };
}

interface Group {
  id: string;
  name: string;
  icon: string;
  baseCurrency: string;
  createdById: string;
  members: Member[];
}

export default function GroupSettingsPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("✈️");
  const [baseCurrency, setBaseCurrency] = useState("TWD");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currencyWarning, setCurrencyWarning] = useState(false);

  const fetchGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (!res.ok) return;
    const data: Group = await res.json();
    setGroup(data);
    setName(data.name);
    setIcon(data.icon ?? "✈️");
    setBaseCurrency(data.baseCurrency);
  }, [groupId]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) { router.replace("/login"); return; }
    fetchGroup();
  }, [user, userLoading, router, fetchGroup]);

  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || !group) return;
    setSaving(true);
    setSaveError(null);
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), icon, baseCurrency }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.text();
      setSaveError(`儲存失敗：${err}`);
      return;
    }
    router.push(`/groups/${groupId}`);
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void; danger?: boolean;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });
  const closeConfirm = () => setConfirmDialog((p) => ({ ...p, open: false }));

  const removeMember = (memberId: string, userId: string) => {
    setConfirmDialog({
      open: true, title: "移除成員", message: "確定要移除此成員嗎？", danger: true,
      onConfirm: async () => {
        closeConfirm();
        setRemovingId(userId);
        await fetch(`/api/groups/${groupId}/members/${userId}`, { method: "DELETE" });
        setRemovingId(null); fetchGroup();
      },
    });
  };

  const deleteGroup = async () => {
    await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    router.replace("/groups");
  };

  if (!group) return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F6FA]">
      <div className="w-8 h-8 border-2 border-[#bae8e8] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isCreator = user?.id === group.createdById;

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F6FA]">
      <header className="bg-[#1E2340] px-4 sticky top-0 z-10 flex items-center gap-3" style={{ height: 60 }}>
        <button onClick={() => router.back()} className="btn-ghost flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-[#A0A8CC]" />
        </button>
        <h1 className="font-semibold text-white text-[17px] flex-1">群組設定</h1>
        <button onClick={save} disabled={saving}
          className="bg-[#2c698d] text-white text-[13px] font-semibold px-4 py-2 rounded-full disabled:opacity-60">
          {saving ? "儲存中..." : "儲存"}
        </button>
      </header>

      <main className="flex-1 overflow-auto px-4 py-4 space-y-4 pb-10">
        {saveError && (
          <div className="bg-[#FFE8EC] rounded-ds-md px-4 py-3 text-[13px] text-[#2c698d]">
            {saveError}
          </div>
        )}

        {/* 群組圖示 */}
        <section className="card space-y-3">
          <h2 className="font-semibold text-[#1A1D2E] text-[15px]">群組圖示</h2>
          <div className="flex flex-wrap gap-2">
            {GROUP_ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={cn(
                  "w-11 h-11 rounded-xl text-2xl flex items-center justify-center border-2 transition-all",
                  icon === emoji
                    ? "border-[#2c698d] bg-[#EEF4FA] scale-110"
                    : "border-[#E8E9F3] bg-white"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>

        {/* 基本資訊 */}
        <section className="card space-y-4">
          <h2 className="font-semibold text-[#1A1D2E] text-[15px]">基本資訊</h2>

          <div>
            <label className="label">群組名稱</label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="群組名稱"
            />
          </div>

          <div>
            <label className="label">結算幣別</label>
            <select
              className="input-field"
              value={baseCurrency}
              onChange={(e) => {
                setCurrencyWarning(e.target.value !== group.baseCurrency);
                setBaseCurrency(e.target.value);
              }}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {currencyWarning && (
              <div className="mt-2 flex items-start gap-2 bg-[#F5A623]/10 rounded-ds-sm p-3">
                <AlertTriangle className="w-4 h-4 text-[#F5A623] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-[#F5A623]">
                  變更結算幣別後，已存在的消費金額不會重新換算，可能造成餘額不準確。建議在新增消費前修改。
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 成員管理 */}
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D2E] text-[15px]">成員管理</h2>
            <span className="text-[12px] text-[#8A90B0]">{group.members.length} 人</span>
          </div>
          <div className="space-y-2">
            {group.members.map((m) => {
              const isOwner = m.userId === group.createdById;
              const isMe = m.userId === user?.id;
              return (
                <div key={m.id} className="flex items-center gap-3 py-1">
                  <Avatar name={m.user.displayName} src={m.user.avatarUrl} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {m.user.displayName}
                      {isMe && <span className="text-xs text-gray-400 ml-1">（我）</span>}
                    </p>
                    {isOwner && <p className="text-[12px] text-[#2c698d]">群組建立者</p>}
                  </div>
                  {isCreator && !isOwner && (
                    <button
                      onClick={() => removeMember(m.id, m.userId)}
                      disabled={removingId === m.userId}
                      className="p-2 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      {removingId === m.userId ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400">邀請新成員請分享群組代碼</p>
        </section>

        {/* 危險操作 */}
        {isCreator && (
          <section className="card space-y-3">
            <h2 className="font-semibold text-[#2c698d] text-[15px]">危險操作</h2>
            <button
              onClick={() => setConfirmDialog({
                open: true, title: "刪除群組", danger: true,
                message: "所有消費紀錄將一併刪除，無法復原。",
                onConfirm: async () => { closeConfirm(); await deleteGroup(); },
              })}
              className="w-full py-2.5 rounded-full border border-[#2c698d] text-[#2c698d] text-[13px] font-semibold hover:bg-[#EEF4FA] transition-colors"
            >
              刪除群組
            </button>
          </section>
        )}
      </main>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}

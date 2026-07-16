/*
 * Публичная конфигурация Supabase. Publishable/anon key безопасно использовать
 * в браузере: доступ к данным ограничивает RLS из supabase/migrations.
 */
window.DEUS_MORTUUS_CONFIG = new URLSearchParams(window.location.search).get("local") === "1"
  ? { supabaseUrl: "", supabaseKey: "" }
  : window.DEUS_MORTUUS_CONFIG || {
      supabaseUrl: "https://ejxzsunagpxsiwpmuovp.supabase.co",
      supabaseKey: "sb_publishable_XtXdV8Q-5CY_I0MjygLXTw_nVSZk0-v",
    };

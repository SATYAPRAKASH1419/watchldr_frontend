export function extractVideoId(videoLink: string): string {
    if (!videoLink) return "";
  
    try {
      const url = new URL(videoLink);
  
      // youtube.com/watch?v=...
      if (url.hostname.includes("youtube.com")) {
        return url.searchParams.get("v") ?? "";
      }
  
      // youtu.be/...
      if (url.hostname === "youtu.be") {
        return url.pathname.slice(1);
      }
  
      return "";
    } catch {
      return "";
    }
  }

  export const baseUrl="http://localhost:3000/api";
  export const socketUrl="http://localhost:3000";
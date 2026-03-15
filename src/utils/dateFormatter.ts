import { Timestamp } from "firebase/firestore";

export const formatDate = (date: Date | Timestamp | string): string => {
  let d: Date;
  if (date instanceof Timestamp) {
    d = date.toDate();
  } else if (typeof date === "string") {
    d = new Date(date);
  } else {
    d = date;
  }
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (date: Date | Timestamp | string): string => {
  let d: Date;
  if (date instanceof Timestamp) {
    d = date.toDate();
  } else if (typeof date === "string") {
    d = new Date(date);
  } else {
    d = date;
  }
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const timeAgo = (date: Date | Timestamp | string): string => {
  let d: Date;
  if (date instanceof Timestamp) {
    d = date.toDate();
  } else if (typeof date === "string") {
    d = new Date(date);
  } else {
    d = date;
  }
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};
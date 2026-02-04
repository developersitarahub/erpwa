import React from "react";
import {
  MessageSquare,
  Image as ImageIcon,
  List,
  Disc,
  Layers,
  PlayCircle,
} from "lucide-react";

export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-16 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col items-center py-4 gap-4 shadow-sm z-10">
      <div
        className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center cursor-move hover:ring-2 hover:ring-purple-400 transition-all"
        onDragStart={(event) => onDragStart(event, "start")}
        draggable
        title="Start / Trigger"
      >
        <PlayCircle size={20} />
      </div>

      <div className="w-8 h-px bg-gray-200 dark:bg-slate-700 my-2" />

      <div
        className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center cursor-move hover:ring-2 hover:ring-blue-400 transition-all"
        onDragStart={(event) => onDragStart(event, "message")}
        draggable
        title="Text Message"
      >
        <MessageSquare size={20} />
      </div>

      <div
        className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg flex items-center justify-center cursor-move hover:ring-2 hover:ring-orange-400 transition-all"
        onDragStart={(event) => onDragStart(event, "button")}
        draggable
        title="Buttons"
      >
        <Disc size={20} />
      </div>

      <div
        className="w-10 h-10 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center cursor-move hover:ring-2 hover:ring-green-400 transition-all"
        onDragStart={(event) => onDragStart(event, "list")}
        draggable
        title="List Menu"
      >
        <List size={20} />
      </div>

      <div
        className="w-10 h-10 bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-lg flex items-center justify-center cursor-move hover:ring-2 hover:ring-pink-400 transition-all"
        onDragStart={(event) => onDragStart(event, "image")}
        draggable
        title="Image"
      >
        <ImageIcon size={20} />
      </div>

      <div
        className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center cursor-move hover:ring-2 hover:ring-indigo-400 transition-all"
        onDragStart={(event) => onDragStart(event, "gallery")}
        draggable
        title="Gallery"
      >
        <Layers size={20} />
      </div>
    </div>
  );
}

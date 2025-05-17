// ScheduleEditor.jsx
// Interactive weekly course schedule editor with drag‑and‑drop, copy / paste, full CRUD, CSV / PNG export.

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Copy, Download, FileText, Plus, Trash2, Edit as EditIcon } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import html2canvas from "html2canvas";

const HOUR_HEIGHT = 60; // px per hour
const DAY_START = 7;
const DAY_END = 22;
const DAYS = ["M", "T", "W", "Th", "F", "Sa"] as const;
const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Generic Schedule for me, load your own.
const initialEventsRaw = [
  ["ASTR 109", "Lec", "M", "1:15 PM", "2:40 PM", false, ""],
  ["ASTR 109", "Lec", "W", "1:15 PM", "2:40 PM", false, ""],
  ["ASTR 109", "Lec", "T", "4:25 PM", "5:50 PM", false, ""],
  ["ASTR 109", "Lec", "Th", "4:25 PM", "5:50 PM", false, ""],
  ["ASTR 110", "Lec", "M", "2:50 PM", "4:15 PM", false, ""],
  ["ASTR 110", "Lec", "W", "2:50 PM", "4:15 PM", false, ""],
  ["ASTR 110", "Lec", "T", "6:00 PM", "7:25 PM", false, ""],
  ["ASTR 110", "Lec", "Th", "6:00 PM", "7:25 PM", false, ""],
  ["ASTR 140", "Lab", "T", "7:35 PM", "10:35 PM", true, ""],
  ["PHYS 109", "Lec", "M", "1:15 PM", "4:15 PM", false, ""],
  ["PHYS 109", "Lab", "W", "1:15 PM", "4:15 PM", true, ""],
  ["PHYS 210", "Lec", "M", "7:35 PM", "8:25 PM", false, ""],
  ["PHYS 210", "Lec", "W", "7:35 PM", "8:25 PM", false, ""],
  ["PHYS 210", "Lab", "M", "4:25 PM", "7:25 PM", true, ""],
  ["PHYS 211", "Lec", "M", "7:35 PM", "8:25 PM", false, ""],
  ["PHYS 211", "Lec", "W", "7:35 PM", "8:25 PM", false, ""],
  ["PHYS 211", "Lab", "W", "4:25 PM", "7:25 PM", true, ""],
  ["PHYS 217", "Lec", "M", "8:30 AM", "9:55 AM", false, ""],
  ["PHYS 217", "Lec", "W", "8:30 AM", "9:55 AM", false, ""],
  ["PHYS 217", "Lab", "M", "10:05 AM", "1:05 PM", true, ""],
  ["PHYS 217", "Lab", "W", "10:05 AM", "1:05 PM", true, ""],
  ["PHYS 217", "Lec", "T", "7:35 PM", "8:25 PM", false, ""],
  ["PHYS 217", "Lec", "Th", "7:35 PM", "8:25 PM", false, ""],
  ["PHYS 217", "Lab", "T", "4:25 PM", "7:25 PM", true, ""],
  ["PHYS 227", "Lec", "T", "8:30 AM", "9:55 AM", false, ""],
  ["PHYS 227", "Lec", "Th", "8:30 AM", "9:55 AM", false, ""],
  ["PHYS 227", "Lab", "T", "10:05 AM", "1:05 PM", true, ""],
  ["PHYS 227", "Lab", "Th", "10:05 AM", "1:05 PM", true, ""],
  ["PHYS 227", "Lec", "T", "7:35 PM", "8:25 PM", false, ""],
  ["PHYS 227", "Lec", "Th", "7:35 PM", "8:25 PM", false, ""],
  ["PHYS 227", "Lab", "Th", "4:25 PM", "7:25 PM", true, ""],
  ["PHYS 237", "Lec", "T", "10:05 AM", "11:30 AM", false, ""],
  ["PHYS 237", "Lec", "Th", "10:05 AM", "11:30 AM", false, ""],
  ["PHYS 237", "Lab", "T", "1:15 PM", "4:15 PM", true, ""],
];

// util ------------------------------------------------------------
const parseTimeFloat = (t) => {
  const [time, mer] = t.trim().split(" ");
  let [h, m] = time.split(":").map(Number);
  if (mer === "PM" && h !== 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return h + m / 60;
};

const to12Hr = (h24, m) => {
  const mer = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${mer}`;
};

// convert "HH:MM" (24‑hr string) to "h:mm AM/PM"
const fromInputTime = (input) => {
  const [h, m] = input.split(":").map(Number);
  return to12Hr(h, m);
};

// color grouping for quick visual cue
const groupColor = (course) => {
  if (course.startsWith("ASTR 1")) return "bg-blue-200";
  if (/PHYS 21[7-9]/.test(course)) return "bg-green-200";
  if (["PHYS 210", "PHYS 211"].includes(course)) return "bg-amber-200";
  return "bg-gray-200";
};

// component -------------------------------------------------------
const ScheduleEditor = () => {
  // state ---------------------------------------------------------
  const [events, setEvents] = useState(
    initialEventsRaw.map((e, idx) => ({
      id: idx.toString(),
      course: e[0],
      suffix: e[1],
      day: e[2],
      start: e[3],
      end: e[4],
      isLab: e[5],
      instructor: e[6],
    }))
  );
  const [editingId, setEditingId] = useState(null); // id of event being edited

  // derived -------------------------------------------------------
  const courseDayPattern = useMemo(() => {
    const order = { M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };
    const map = {};
    events.forEach((e) => {
      map[e.course] = map[e.course] || new Set();
      map[e.course].add(e.day);
    });
    return Object.fromEntries(
      Object.entries(map).map(([c, set]) => [
        c,
        Array.from(set)
          .sort((a, b) => order[a] - order[b])
          .join("/"),
      ])
    );
  }, [events]);

  const layout = useMemo(() => {
    const byDay = Object.fromEntries(DAYS.map((d) => [d, []]));
    events.forEach((ev) => byDay[ev.day].push(ev));

    const pos = {};
    DAYS.forEach((d) => {
      const items = byDay[d].sort((a, b) => parseTimeFloat(a.start) - parseTimeFloat(b.start));
      const colEnds = [];
      items.forEach((ev) => {
        let col = 0;
        while (col < colEnds.length && parseTimeFloat(ev.start) < colEnds[col]) col++;
        if (col === colEnds.length) colEnds.push(parseTimeFloat(ev.end));
        else colEnds[col] = parseTimeFloat(ev.end);
        pos[ev.id] = { col, totalCols: colEnds.length };
      });
    });
    return pos;
  }, [events]);

  // handlers ------------------------------------------------------
  const onDragEnd = (result) => {
    if (!result.destination) return;
    setEvents((prev) =>
      prev.map((e) => (e.id === result.draggableId ? { ...e, day: result.destination.droppableId } : e))
    );
  };

  const duplicate = (id) => {
    setEvents((prev) => {
      const ev = prev.find((e) => e.id === id);
      const copy = { ...ev, id: Date.now().toString(), day: "F" };
      return [...prev, copy];
    });
  };

  const remove = (id) => setEvents((prev) => prev.filter((e) => e.id !== id));

  const addBlank = () => {
    const newId = Date.now().toString();
    const blank = {
      id: newId,
      course: "NEW",
      suffix: "",
      day: "M",
      start: "8:00 AM",
      end: "9:00 AM",
      isLab: false,
      instructor: "",
    };
    setEvents((prev) => [...prev, blank]);
    setEditingId(newId);
  };

  const updateField = (id, field, value) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  // export helpers ------------------------------------------------
  const exportPNG = async () => {
    const node = document.getElementById("schedule-area");
    if (!node) return;
    const canvas = await html2canvas(node, { backgroundColor: "#fff" });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "schedule.png";
    link.click();
  };

  const exportCSV = () => {
    const header = ["Course", "Suffix", "Day", "Start", "End", "Instructor"];
    const rows = events.map((e) => [e.course, e.suffix, e.day, e.start, e.end, e.instructor]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "schedule.csv";
    link.click();
  };

  // render --------------------------------------------------------
  const hours = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i);

  return (
    <Card className="w-full h-full flex flex-col p-4 gap-4 rounded-2xl shadow-lg">
      {/* header */}
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-xl font-semibold">Weekly Schedule</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addBlank}>
            <Plus className="w-4 h-4 mr-1" /> Add Class
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <FileText className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportPNG}>
            <Download className="w-4 h-4 mr-1" /> PNG
          </Button>
        </div>
      </CardHeader>

      {/* body */}
      <CardContent className="flex overflow-auto">
        {/* time ruler */}
        <div className="flex flex-col items-end pr-2 text-xs select-none">
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT }} className="w-12 text-right pr-1 leading-none">
              {h}:00
            </div>
          ))}
        </div>

        {/* grid */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div id="schedule-area" className="relative flex border-l border-gray-300">
            {DAYS.map((d, idx) => (
              <Droppable droppableId={d} key={d}>
                {(provided) => {
                  const maxCols = Math.max(
                    ...events.filter((e) => e.day === d).map((e) => layout[e.id]?.totalCols || 1),
                    1
                  );
                  return (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="border-r border-gray-300 relative"
                      style={{ width: maxCols * 120 }}
                    >
                      <div className="text-center font-medium text-sm py-1 bg-gray-50 sticky top-0 z-10 border-b border-gray-300">
                        {DAY_LABELS[idx]}
                      </div>
                      {events
                        .filter((e) => e.day === d)
                        .map((e) => {
                          const pos = layout[e.id];
                          const top = (parseTimeFloat(e.start) - DAY_START) * HOUR_HEIGHT;
                          const height = (parseTimeFloat(e.end) - parseTimeFloat(e.start)) * HOUR_HEIGHT;
                          const width = 120;
                          const left = pos.col * width;
                          return (
                            <Draggable draggableId={e.id} index={0} key={e.id}>
                              {(drag) => (
                                <div
                                  ref={drag.innerRef}
                                  {...drag.draggableProps}
                                  {...drag.dragHandleProps}
                                  style={{
                                    ...drag.draggableProps.style,
                                    top,
                                    left,
                                    width: width - 8,
                                    height: height - 4,
                                  }}
                                  className={`${groupColor(e.course)} absolute p-2 rounded-2xl shadow-md text-[0.65rem] leading-tight overflow-hidden cursor-move group`}
                                >
                                  <div className="font-semibold text-[0.7rem] truncate">
                                    {e.course} {e.suffix}
                                  </div>
                                  <div className="text-[0.7rem]">{courseDayPattern[e.course]}</div>
                                  <div>{e.start} – {e.end}</div>
                                  <div className="italic text-gray-600 truncate">{e.instructor || "<no instructor>"}</div>
                                  <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                    <Button size="icon" variant="ghost" className="w-5 h-5 p-0" onClick={(ev) => { ev.stopPropagation(); duplicate(e.id); }}>
                                      <Copy className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="w-5 h-5 p-0" onClick={(ev) => { ev.stopPropagation(); setEditingId(e.id); }}>
                                      <EditIcon className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="w-5 h-5 p-0" onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                      {provided.placeholder}
                    </div>
                  );
                }}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </CardContent>

      {/* edit dialog ------------------------------------------------*/}
      {editingId && (
        <Dialog open onOpenChange={() => setEditingId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Class</DialogTitle>
            </DialogHeader>
            {(() => {
              const ev = events.find((e) => e.id === editingId);
              if (!ev) return null;
              return (
                <div className="space-y-3 py-2 text-sm">
                  <div className="grid grid-cols-4 items-center gap-2">
                    <label className="col-span-1">Course</label>
                    <Input
                      className="col-span-3"
                      value={ev.course}
                      onChange={(e) => updateField(ev.id, "course", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-2">
                    <label>Suffix</label>
                    <Input
                      className="col-span-3"
                      value={ev.suffix}
                      onChange={(e) => updateField(ev.id, "suffix", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-2">
                    <label>Day</label>
                    <select
                      value={ev.day}
                      className="col-span-3 border rounded-md h-8 px-2"
                      onChange={(e) => updateField(ev.id, "day", e.target.value)}
                    >
                      {DAYS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-2">
                    <label>Start</label>
                    <input
                      type="time"
                      className="col-span-3 border rounded-md h-8 px-2"
                      value={(() => {
                        const f = parseTimeFloat(ev.start);
                        const h24 = Math.floor(f);
                        const m = Math.round((f - h24) * 60);
                        return `${h24.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                      })()}
                      onChange={(e) => updateField(ev.id, "start", fromInputTime(e.target.value))}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-2">
                    <label>End</label>
                    <input
                      type="time"
                      className="col-span-3 border rounded-md h-8 px-2"
                      value={(() => {
                        const f = parseTimeFloat(ev.end);
                        const h24 = Math.floor(f);
                        const m = Math.round((f - h24) * 60);
                        return `${h24.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                      })()}
                      onChange={(e) => updateField(ev.id, "end", fromInputTime(e.target.value))}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-2">
                    <label>Instructor</label>
                    <Input
                      className="col-span-3"
                      value={ev.instructor}
                      onChange={(e) => updateField(ev.id, "instructor", e.target.value)}
                    />
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="secondary" onClick={() => setEditingId(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default ScheduleEditor;

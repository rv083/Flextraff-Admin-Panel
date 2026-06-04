// src/pages/Controls.jsx
import { useEffect, useState } from "react";
import supabase from "../../lib/supabaseClient";
import Sidebar from "../../components/layout/Sidebar";

export default function Controls({ darkMode, toggleDarkMode }) {
  const [junctions, setJunctions] = useState([]);
  const [selectedJunction, setSelectedJunction] = useState(null);

  // mode and automatic/manual values (same as your original)
  const [mode, setMode] = useState("automatic");
  const [autoMinCycle, setAutoMinCycle] = useState(30);
  const [autoMaxCycle, setAutoMaxCycle] = useState(90);
  const [manualCycle, setManualCycle] = useState(60);
  const [greenTimes, setGreenTimes] = useState({ north: 15, south: 15, east: 15, west: 15 });
  const [error, setError] = useState("");
  const lanes = ["north", "south", "east", "west"];
  const [existingCycle, setExistingCycle] = useState(null);
  const labelText = darkMode ? "text-yellow-400" : "text-blue-700";
  const inputBg = darkMode ? "bg-gray-800" : "bg-gray-100";
  const inputBorder = darkMode ? "border border-gray-700" : "border border-gray-300";
  const inputText = darkMode ? "text-white" : "text-gray-900";
  const inputFocusRing = darkMode ? "focus:ring-yellow-400" : "focus:ring-blue-500";
  const helperText = darkMode ? "text-yellow-300" : "text-blue-500";

  useEffect(() => {
    fetchJunctions();
  }, []);

  useEffect(() => {
    if (selectedJunction) loadCycleForJunction(selectedJunction);
  }, [selectedJunction]);

  async function fetchJunctions() {
    const { data, error } = await supabase.from("traffic_junctions").select("id,junction_name").order("id", { ascending: true });
    if (error) console.error(error);
    else setJunctions(data ?? []);
    if (data && data.length) setSelectedJunction(data[0].id);
  }

  async function loadCycleForJunction(junctionId) {
    // get latest cycle for junction
    const { data, error } = await supabase
      .from("traffic_cycles")
      .select("*")
      .eq("junction_id", junctionId)
      .order("id", { ascending: false })
      .limit(1);

    if (error) {
      console.error(error);
      return;
    }
    const cycle = data && data.length ? data[0] : null;
    if (cycle) {
      setExistingCycle(cycle);
      setMode(cycle.status === "automatic" ? "automatic" : "manual");
      setManualCycle(cycle.total_cycle_time ?? 60);
      setGreenTimes({
        north: cycle.lane_1_green_time ?? 0,
        south: cycle.lane_2_green_time ?? 0,
        east: cycle.lane_3_green_time ?? 0,
        west: cycle.lane_4_green_time ?? 0,
      });
      // We don't try to map algorithm_version here
    } else {
      setExistingCycle(null);
    }
  }

  const handleModeChange = (e) => {
    setMode(e.target.value);
    setError("");
  };

  const handleGreenTimeChangeManual = (lane, value) => {
    let valNum = Number(value);
    if (valNum < 0) valNum = 0;

    if (lane !== "west") {
      const newGreenTimes = { ...greenTimes, [lane]: valNum };

      const sumFirstThree = lanes
        .filter((l) => l !== "west")
        .reduce((acc, l) => (l === lane ? acc + valNum : acc + greenTimes[l]), 0);

      const availableForLast = manualCycle - sumFirstThree;

      if (availableForLast < 0) {
        setError("Not sufficient green time available. Please reduce other lanes.");
        return;
      }

      newGreenTimes["west"] = availableForLast >= 0 ? availableForLast : 0;
      setGreenTimes(newGreenTimes);
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedJunction) {
      alert("Select a junction first.");
      return;
    }

    if (mode === "automatic") {
      // save automatic config to traffic_cycles with status 'automatic'
      const payload = {
        junction_id: selectedJunction,
        total_cycle_time: null,
        lane_1_green_time: null,
        lane_2_green_time: null,
        lane_3_green_time: null,
        lane_4_green_time: null,
        algorithm_version: `auto-${Date.now()}`,
        calculation_time_ms: 0,
        status: "automatic",
      };

      try {
        if (existingCycle && existingCycle.status === "automatic") {
          await supabase.from("traffic_cycles").update(payload).eq("id", existingCycle.id);
        } else {
          await supabase.from("traffic_cycles").insert(payload);
        }
        alert(`Automatic mode set with Min: ${autoMinCycle}s, Max: ${autoMaxCycle}s`);
        loadCycleForJunction(selectedJunction);
      } catch (err) {
        console.error(err);
        alert("Error saving automatic mode");
      }
    } else {
      // manual mode -> save total and lane_# fields
      const payload = {
        junction_id: selectedJunction,
        total_cycle_time: manualCycle,
        lane_1_green_time: greenTimes.north,
        lane_2_green_time: greenTimes.south,
        lane_3_green_time: greenTimes.east,
        lane_4_green_time: greenTimes.west,
        algorithm_version: `manual-${Date.now()}`,
        calculation_time_ms: 0,
        status: "manual",
      };

      try {
        if (existingCycle && existingCycle.status === "manual") {
          await supabase.from("traffic_cycles").update(payload).eq("id", existingCycle.id);
        } else {
          await supabase.from("traffic_cycles").insert(payload);
        }
        alert(`Manual mode set with Cycle: ${manualCycle}s and Greens saved.`);
        loadCycleForJunction(selectedJunction);
      } catch (err) {
        console.error(err);
        alert("Error saving manual mode");
      }
    }
  };

  return (
    <div className={`h-screen flex ${darkMode ? "bg-gray-950 text-white" : "bg-white text-gray-900"} transition-colors duration-300`}>
      <Sidebar darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

      <main className="flex-1 p-8 overflow-y-auto">
        <h2 className={`text-3xl font-semibold mb-6 ${labelText}`}>Traffic Light Controls</h2>

        <div className="mb-6 max-w-xl">
          <label className={`block mb-2 font-semibold ${labelText}`}>Select Junction</label>
          <select value={selectedJunction ?? ""} onChange={(e) => setSelectedJunction(Number(e.target.value))} className={`${inputBg} ${inputBorder} ${inputText} w-full p-3 rounded-lg focus:outline-none ${inputFocusRing}`}>
            <option value="">-- select junction --</option>
            {junctions.map((j) => <option key={j.id} value={j.id}>{j.junction_name}</option>)}
          </select>
        </div>

        <form onSubmit={handleSubmit} className="max-w-lg">
          <div className="mb-6">
            <label className={`block mb-2 font-semibold ${labelText}`}>Select Mode</label>
            <select value={mode} onChange={handleModeChange} className={`${inputBg} ${inputBorder} ${inputText} w-full p-3 rounded-lg focus:outline-none ${inputFocusRing}`}>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual Override</option>
            </select>
          </div>

          {mode === "automatic" && (
            <>
              <div className="mb-4">
                <label className={`block mb-1 ${labelText}`}>Minimum Cycle Time (seconds)</label>
                <input type="number" min="10" value={autoMinCycle} onChange={(e) => setAutoMinCycle(Number(e.target.value))} className={`${inputBg} ${inputBorder} ${inputText} w-full p-3 rounded-lg focus:outline-none ${inputFocusRing}`} required />
              </div>
              <div className="mb-4">
                <label className={`block mb-1 ${labelText}`}>Maximum Cycle Time (seconds)</label>
                <input type="number" min={autoMinCycle} value={autoMaxCycle} onChange={(e) => setAutoMaxCycle(Number(e.target.value))} className={`${inputBg} ${inputBorder} ${inputText} w-full p-3 rounded-lg focus:outline-none ${inputFocusRing}`} required />
              </div>
            </>
          )}

          {mode === "manual" && (
            <div className={`space-y-7 border border-gray-700 rounded-lg p-6 ${inputBg} shadow-md`}>
              <h3 className={`text-xl font-semibold mb-3 border-b border-gray-700 pb-2 ${labelText}`}>Manual Override Settings</h3>
              <div>
                <label className={`block mb-2 font-medium ${labelText}`}>Total Cycle Time (seconds)</label>
                <input type="number" min="10" value={manualCycle} onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setManualCycle(val);
                  setError("");
                  const sumOthers = lanes.filter((l) => l !== "west").reduce((acc, l) => acc + (greenTimes[l] || 0), 0);
                  if (sumOthers > val) {
                    setError("Assigned green times exceed total cycle time.");
                  } else {
                    setGreenTimes((gt) => ({ ...gt, west: val - sumOthers }));
                  }
                }} className={`${inputBg} ${inputBorder} ${inputText} w-full p-3 rounded-lg focus:outline-none ${inputFocusRing}`} required />
                <p className={`text-sm mt-1 ${helperText}`}>Total duration of one complete signal cycle.</p>
              </div>

              <div>
                <div className={`mb-2 font-semibold border-b border-gray-700 pb-2 ${labelText}`}>Individual Lane Green Times</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {lanes.slice(0, 3).map((lane) => (
                    <div key={lane}>
                      <label className={`block mb-1 capitalize font-medium ${labelText}`}>{lane} Lane</label>
                      <input type="number" min="5" value={greenTimes[lane]} onChange={(e) => handleGreenTimeChangeManual(lane, e.target.value)} className={`${inputBg} ${inputBorder} ${inputText} w-full p-3 rounded-lg focus:outline-none ${inputFocusRing}`} required />
                    </div>
                  ))}
                  <div>
                    <label className="block mb-1 capitalize font-medium text-gray-400">West Lane (auto-filled)</label>
                    <input type="number" value={greenTimes["west"]} className="w-full p-3 rounded-lg bg-gray-700 border border-gray-500 text-gray-400 cursor-not-allowed" readOnly />
                    <p className="text-xs text-gray-500 mt-1 italic">Auto-calculated from remaining cycle time.</p>
                  </div>
                </div>
                {error && <p className="mt-2 text-red-500 font-semibold">{error}</p>}
              </div>
            </div>
          )}

          <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 px-6 rounded-lg transition mt-4">Save Settings</button>
        </form>
{/* 
        {existingCycle && (
          <div className="mt-8 max-w-xl p-4 rounded bg-gray-50 text-sm">
            <div><strong>Last saved:</strong> {existingCycle.id} — status: {existingCycle.status}</div>
            <div className="mt-2 text-xs text-gray-600">Algorithm: {existingCycle.algorithm_version}</div>
          </div>
        )} */}
      </main>
    </div>
  );
}

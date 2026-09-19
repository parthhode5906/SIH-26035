import React, { useState } from 'react';
import { Activity, BarChart3, Info, Thermometer } from 'lucide-react';
import { EnvironmentCard } from '@/components/Card';

export function EnvironmentModule({ onDrift }) {
  const [temperature, setTemperature] = useState(21.4);
  const [drifted, setDrifted] = useState(false);

  const simulateDrift = () => {
    const nextDrift = !drifted;
    setDrifted(nextDrift);
    setTemperature(nextDrift ? 27.8 : 21.4);
    if (onDrift) {
      onDrift(nextDrift);
    }
  };

  return (
    <div className="animate-rise">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="max-w-xl text-sm leading-6 text-[#58746f]">
            Environmental conditions are recorded at the time of evaluation. Current values are supplied by the local bench sensor.
          </p>
        </div>
        <span className={`flex items-center gap-2 text-xs font-semibold ${drifted ? 'text-[#b24b43]' : 'text-[#2e7568]'}`}>
          <span className={`status-dot ${drifted ? '!bg-[#b24b43] !shadow-[#f7dfdc]' : ''}`} />
          {drifted ? 'Drift exceeded' : 'Sensor connected'}
        </span>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <EnvironmentCard
          label="Temperature"
          value={temperature.toFixed(1)}
          unit="°C"
          range="20–23 °C"
          icon={Thermometer}
        />
        <EnvironmentCard
          label="Humidity"
          value="43"
          unit="% RH"
          range="35–60 % RH"
          icon={Activity}
        />
        <EnvironmentCard
          label="Air pressure"
          value="101.3"
          unit="kPa"
          range="98–104 kPa"
          icon={BarChart3}
        />
      </div>

      <div
        className={`mt-7 rounded-lg border p-4 text-xs ${
          drifted
            ? 'border-[#e7b5ae] bg-[#fff5f3] text-[#a6423b]'
            : 'border-[#c9d9d1] bg-[#f8fbf8] text-[#66837d]'
        }`}
      >
        <Info size={14} className={`mr-2 inline ${drifted ? 'text-[#b24b43]' : 'text-[#2e7568]'}`} />
        {drifted
          ? 'Temperature drift exceeds the ±5 °C session limit. Flagged for review and restart recommendation.'
          : 'All environmental readings are within the recommended operating range.'}
        <button
          onClick={simulateDrift}
          className="ml-3 font-semibold underline underline-offset-2 hover:text-[#17333c]"
          data-testid="button-simulate-drift"
        >
          {drifted ? 'Restore stable reading' : 'Simulate drift'}
        </button>
      </div>
    </div>
  );
}

export default EnvironmentModule;

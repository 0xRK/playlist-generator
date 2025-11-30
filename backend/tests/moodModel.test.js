const { inferMood } = require('../src/services/moodModel');

describe('Mood Model', () => {
    test('should infer "flow" mood when readiness and sleep are high', async () => {
        const metrics = {
            metrics: {
                readiness: 85,
                sleepQuality: 80,
                hrv: 60,
                strain: 10,
                restingHeartRate: 55
            }
        };
        const result = await inferMood(metrics);
        expect(result.label).toBe('flow');
    });

    test('should infer "amped" mood when strain is high and readiness is moderate', async () => {
        const metrics = {
            metrics: {
                readiness: 60,
                sleepQuality: 70,
                hrv: 50,
                strain: 18, // High strain
                restingHeartRate: 60
            }
        };
        // Normalized strain: 18/21 = ~0.85 (>0.6)
        // Normalized readiness: 60/100 = 0.6 (>0.55)
        const result = await inferMood(metrics);
        expect(result.label).toBe('amped');
    });

    test('should infer "recovery" mood when readiness or sleep is low', async () => {
        const metrics = {
            metrics: {
                readiness: 40,
                sleepQuality: 50,
                hrv: 30,
                strain: 12,
                restingHeartRate: 65
            }
        };
        const result = await inferMood(metrics);
        expect(result.label).toBe('recovery');
    });

    test('should default to "reset" when no other conditions match', async () => {
        const metrics = {
            metrics: {
                readiness: 50,
                sleepQuality: 50,
                hrv: 40,
                strain: 10,
                restingHeartRate: 60
            }
        };
        // readiness 0.5, sleep 0.5 -> not flow (>0.7), not amped (>0.55 readiness but strain 10/21=0.47 <0.6), not recovery (<0.45)
        const result = await inferMood(metrics);
        expect(result.label).toBe('reset');
    });

    test('should throw error if no metrics provided', async () => {
        await expect(inferMood(null)).rejects.toThrow('No wearable data has been ingested yet.');
    });
});

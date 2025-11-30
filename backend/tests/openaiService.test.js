const axios = require('axios');
const openaiService = require('../src/services/openaiService');

jest.mock('axios');

describe('OpenAI Service', () => {
    const mockBiometricData = {
        metrics: {
            readiness: 80,
            sleepQuality: 75,
            hrv: 55,
            strain: 12,
            restingHeartRate: 58
        },
        providers: ['Whoop'],
        lastUpdated: new Date().toISOString()
    };

    const mockCalendarEvents = [
        { title: 'Meeting', start: new Date().toISOString(), duration: 30 }
    ];

    const mockWeatherData = {
        condition: 'Sunny',
        temperature: '72F'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.OPENAI_API_KEY = 'test-key';
    });

    test('should call OpenAI API and return parsed result', async () => {
        const mockResponse = {
            data: {
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                mood: 'flow',
                                energy: 0.8,
                                valence: 0.7,
                                tempo: 120,
                                genres: ['lo-fi', 'ambient'],
                                searchQuery: 'focus music',
                                reasoning: 'Good readiness'
                            })
                        }
                    }
                ]
            }
        };

        axios.post.mockResolvedValue(mockResponse);

        const result = await openaiService.analyzeAndGeneratePlaylistParams(
            mockBiometricData,
            mockCalendarEvents,
            mockWeatherData,
            ''
        );

        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(result.mood).toBe('flow');
        expect(result.energy).toBe(0.8);
        expect(result.genres).toContain('lo-fi');
    });

    test('should handle OpenAI API errors', async () => {
        axios.post.mockRejectedValue(new Error('API Error'));

        await expect(openaiService.analyzeAndGeneratePlaylistParams(
            mockBiometricData,
            mockCalendarEvents,
            mockWeatherData,
            ''
        )).rejects.toThrow('OpenAI API request failed: API Error');
    });

    test('should throw error if API key is missing', async () => {
        delete process.env.OPENAI_API_KEY;
        await expect(openaiService.analyzeAndGeneratePlaylistParams(
            mockBiometricData,
            mockCalendarEvents,
            mockWeatherData,
            ''
        )).rejects.toThrow('OPENAI_API_KEY is not configured');
    });
});

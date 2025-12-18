import { describe, it, expect } from 'vitest';
import { decodeJwtPayload } from './jwt';

describe('decodeJwtPayload', () => {
    it('debería decodificar correctamente el payload de un JWT válido', () => {
        const token = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IjZ0OHFzNDJVdElBcGplaXkiLCJ0eXAiOiJKV1QifQ.eyJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2NjA2OTgyMn1dLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwiYXVkIjoiYXV0aGVudGljYXRlZCIsImVtYWlsIjoibmFjaG9yb21lcm84NEBob3RtYWlsLmNvbSIsImV4cCI6MTc2NjA4MzI5OCwiaWF0IjoxNzY2MDc5Njk4LCJpc19hbm9ueW1vdXMiOmZhbHNlLCJpc3MiOiJodHRwczovL2l6Y3p1b2hldHNvY2dyY2p1cGd5LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJwaG9uZSI6IiIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwic2Vzc2lvbl9pZCI6IjAxOGI5ZjVhLTdjMzgtNDU2Zi05MzgzLTYxYWI5YTc2MmMyOCIsInN1YiI6ImM1MTNjMzBlLTkyNmItNDkzMy05NWVmLTYxMTZmNzFhOTIyZCIsInRlbmFudF9pZCI6ImQzNmFjYzNiLTc2ODUtNDU2Mi04YjdmLTYwNzU1YWQzMjhmYSIsInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJ1c2VyX3JvbGUiOiJhZG1pbiJ9.3Rs6m0eJtMFPXgBvKhiBkDI4wGQGaJCmoLjUjt_2fZo';
        const payload = decodeJwtPayload(token);
        expect(payload).toBeDefined();
        expect(payload).toEqual(
            {
                "aal": "aal1",
                "amr": [
                    {
                        "method": "password",
                        "timestamp": 1766069822
                    }
                ],
                "app_metadata": {
                    "provider": "email",
                    "providers": [
                        "email"
                    ]
                },
                "aud": "authenticated",
                "email": "nachoromero84@hotmail.com",
                "exp": 1766083298,
                "iat": 1766079698,
                "is_anonymous": false,
                "iss": "https://izczuohetsocgrcjupgy.supabase.co/auth/v1",
                "phone": "",
                "role": "authenticated",
                "session_id": "018b9f5a-7c38-456f-9383-61ab9a762c28",
                "sub": "c513c30e-926b-4933-95ef-6116f71a922d",
                "tenant_id": "d36acc3b-7685-4562-8b7f-60755ad328fa",
                "user_metadata": {
                    "email_verified": true
                },
                "user_role": "admin"
            }
        );
        expect(payload?.email).toBe('nachoromero84@hotmail.com');
    });
});

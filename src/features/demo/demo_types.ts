export type DemoInput = {
    name: string,
    email: string,
    // Optional: the booking schema marks it optional and BookDemo.company is nullable.
    company?: string,
    notes?: string,
    scheduledAt: Date,
    timezone: string,
    countryCode?: string,
    countryName?: string,
    localTimeLabel?: string,
    istTimeLabel?: string,
}

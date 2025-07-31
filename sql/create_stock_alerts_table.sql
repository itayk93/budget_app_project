
CREATE TABLE stock_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    stock_symbol VARCHAR(10) NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- e.g., 'price_above', 'price_below', 'change_percent'
    target_value NUMERIC NOT NULL,
    notification_method VARCHAR(50) DEFAULT 'browser',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    triggered_at TIMESTAMPTZ
);

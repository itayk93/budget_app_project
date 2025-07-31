-- יצירת טבלה חדשה ליעדים משותפים
CREATE TABLE IF NOT EXISTS shared_category_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_category_name VARCHAR(255) NOT NULL,
    monthly_target DECIMAL(15,2) DEFAULT 0,
    weekly_display BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, shared_category_name)
);

-- יצירת אינדקס לחיפוש מהיר
CREATE INDEX IF NOT EXISTS idx_shared_category_targets_user_shared 
ON shared_category_targets(user_id, shared_category_name);

-- הוספת עמודה לזיהוי אם קטגוריה משתמשת ביעד משותף
ALTER TABLE category_order 
ADD COLUMN IF NOT EXISTS use_shared_target BOOLEAN DEFAULT true;

-- עדכון טריגר לעדכון updated_at
CREATE OR REPLACE FUNCTION update_shared_category_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shared_category_targets_updated_at
    BEFORE UPDATE ON shared_category_targets
    FOR EACH ROW
    EXECUTE FUNCTION update_shared_category_targets_updated_at();

-- הגדרת RLS (Row Level Security) אם צריך
ALTER TABLE shared_category_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own shared category targets" ON shared_category_targets
    FOR ALL USING (auth.uid() = user_id);
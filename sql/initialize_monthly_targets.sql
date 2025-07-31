-- Initialize monthly targets for existing categories based on 3-month average spending
-- This query will calculate and set initial monthly targets for all categories that don't have one

-- Function to calculate 3-month average spending for a category
CREATE OR REPLACE FUNCTION calculate_monthly_average(
    p_user_id UUID,
    p_category_name VARCHAR(255),
    p_months INTEGER DEFAULT 3
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_current_month INTEGER;
    v_current_year INTEGER;
    v_month INTEGER;
    v_year INTEGER;
    v_total_spending DECIMAL(10,2) := 0;
    v_month_count INTEGER := 0;
    v_month_spending DECIMAL(10,2);
    i INTEGER;
BEGIN
    -- Get current month and year
    SELECT EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE)
    INTO v_current_month, v_current_year;
    
    -- Loop through the last N months (excluding current month)
    FOR i IN 1..p_months LOOP
        v_month := v_current_month - i;
        v_year := v_current_year;
        
        -- Handle year rollover
        IF v_month <= 0 THEN
            v_month := v_month + 12;
            v_year := v_year - 1;
        END IF;
        
        -- Calculate spending for this month
        SELECT COALESCE(SUM(ABS(amount)), 0)
        INTO v_month_spending
        FROM transactions
        WHERE user_id = p_user_id
            AND category_name = p_category_name
            AND payment_month = v_month
            AND payment_year = v_year
            AND amount < 0; -- Only expenses (negative amounts)
        
        -- Only count months with spending data
        IF v_month_spending > 0 THEN
            v_total_spending := v_total_spending + v_month_spending;
            v_month_count := v_month_count + 1;
        END IF;
    END LOOP;
    
    -- Return average (or 0 if no data)
    IF v_month_count > 0 THEN
        RETURN ROUND(v_total_spending / v_month_count, 2);
    ELSE 
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update all categories that don't have a monthly target
-- This will set the monthly_target based on 3-month average spending
UPDATE category_order 
SET monthly_target = calculate_monthly_average(user_id, category_name, 3),
    updated_at = now()
WHERE monthly_target IS NULL 
    AND calculate_monthly_average(user_id, category_name, 3) > 0;

-- Optional: Show results of the update
SELECT 
    user_id,
    category_name,
    monthly_target,
    weekly_display,
    updated_at
FROM category_order 
WHERE monthly_target IS NOT NULL
ORDER BY user_id, display_order;

-- Drop the function if you don't need it for ongoing use
-- (Keep it if you want to use it programmatically later)
-- DROP FUNCTION IF EXISTS calculate_monthly_average(UUID, VARCHAR(255), INTEGER);
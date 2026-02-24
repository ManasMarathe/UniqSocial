package profile

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/uniqsocial/backend/internal/auth"
	"github.com/uniqsocial/backend/pkg/response"
)

type Handler struct {
	db *pgxpool.Pool
}

type Profile struct {
	DisplayName          string   `json:"display_name"`
	Age                  *int     `json:"age"`
	City                 string   `json:"city"`
	Occupation           string   `json:"occupation"`
	IdealWeekend         string   `json:"ideal_weekend"`
	LoveTalkingAbout     string   `json:"love_talking_about"`
	EnergyLevel          string   `json:"energy_level"`
	SocialStyle          string   `json:"social_style"`
	SleepSchedule        string   `json:"sleep_schedule"`
	Drinking             string   `json:"drinking"`
	FitnessLevel         string   `json:"fitness_level"`
	WorkSchedule         string   `json:"work_schedule"`
	LookingFor           []string `json:"looking_for"`
	CurrentlyInterestedIn []string `json:"currently_interested_in"`
	ProfileCompleted     bool     `json:"profile_completed"`
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())

	var p Profile
	var age *int
	var lookingFor, currentlyInterestedIn json.RawMessage

	err := h.db.QueryRow(context.Background(),
		`SELECT COALESCE(display_name,''), age, COALESCE(city,''), COALESCE(occupation,''),
		        COALESCE(ideal_weekend,''), COALESCE(love_talking_about,''),
		        COALESCE(energy_level,''), COALESCE(social_style,''),
		        COALESCE(sleep_schedule,''), COALESCE(drinking,''),
		        COALESCE(fitness_level,''), COALESCE(work_schedule,''),
		        COALESCE(looking_for,'[]'::jsonb), COALESCE(currently_interested_in,'[]'::jsonb),
		        profile_completed
		 FROM user_profiles WHERE user_id = $1`, userID,
	).Scan(&p.DisplayName, &age, &p.City, &p.Occupation,
		&p.IdealWeekend, &p.LoveTalkingAbout, &p.EnergyLevel, &p.SocialStyle,
		&p.SleepSchedule, &p.Drinking, &p.FitnessLevel, &p.WorkSchedule,
		&lookingFor, &currentlyInterestedIn, &p.ProfileCompleted)

	if err != nil {
		response.JSON(w, http.StatusOK, Profile{
			LookingFor:            []string{},
			CurrentlyInterestedIn: []string{},
		})
		return
	}

	p.Age = age
	_ = json.Unmarshal(lookingFor, &p.LookingFor)
	_ = json.Unmarshal(currentlyInterestedIn, &p.CurrentlyInterestedIn)
	if p.LookingFor == nil {
		p.LookingFor = []string{}
	}
	if p.CurrentlyInterestedIn == nil {
		p.CurrentlyInterestedIn = []string{}
	}

	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r.Context())

	var req Profile
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	lookingForJSON, _ := json.Marshal(req.LookingFor)
	if req.LookingFor == nil {
		lookingForJSON = []byte("[]")
	}
	currentlyInterestedInJSON, _ := json.Marshal(req.CurrentlyInterestedIn)
	if req.CurrentlyInterestedIn == nil {
		currentlyInterestedInJSON = []byte("[]")
	}

	completed := req.DisplayName != "" && req.Age != nil && *req.Age > 0 &&
		req.City != "" && req.Occupation != "" &&
		req.IdealWeekend != "" && req.LoveTalkingAbout != "" &&
		req.EnergyLevel != "" && req.SocialStyle != "" &&
		req.SleepSchedule != "" && req.Drinking != "" &&
		req.FitnessLevel != "" && req.WorkSchedule != "" &&
		len(req.LookingFor) > 0 && len(req.CurrentlyInterestedIn) > 0

	_, err := h.db.Exec(context.Background(),
		`INSERT INTO user_profiles (
		    user_id, display_name, age, city, occupation,
		    ideal_weekend, love_talking_about, energy_level, social_style,
		    sleep_schedule, drinking, fitness_level, work_schedule,
		    looking_for, currently_interested_in, profile_completed
		 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		 ON CONFLICT (user_id) DO UPDATE SET
		    display_name=EXCLUDED.display_name, age=EXCLUDED.age,
		    city=EXCLUDED.city, occupation=EXCLUDED.occupation,
		    ideal_weekend=EXCLUDED.ideal_weekend, love_talking_about=EXCLUDED.love_talking_about,
		    energy_level=EXCLUDED.energy_level, social_style=EXCLUDED.social_style,
		    sleep_schedule=EXCLUDED.sleep_schedule, drinking=EXCLUDED.drinking,
		    fitness_level=EXCLUDED.fitness_level, work_schedule=EXCLUDED.work_schedule,
		    looking_for=EXCLUDED.looking_for, currently_interested_in=EXCLUDED.currently_interested_in,
		    profile_completed=EXCLUDED.profile_completed, updated_at=NOW()`,
		userID, req.DisplayName, req.Age, req.City, req.Occupation,
		req.IdealWeekend, req.LoveTalkingAbout, req.EnergyLevel, req.SocialStyle,
		req.SleepSchedule, req.Drinking, req.FitnessLevel, req.WorkSchedule,
		lookingForJSON, currentlyInterestedInJSON, completed)

	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"status":            "updated",
		"profile_completed": completed,
	})
}

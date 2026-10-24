CREATE TABLE "bullet_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bullet_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"label" text,
	"source" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bullet_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_bullets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_bullets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"fields" jsonb NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resume_item_links" (
	"resume_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "resume_item_links_resume_id_item_id_pk" PRIMARY KEY("resume_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "resume_item_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bullet_variants" ADD CONSTRAINT "bullet_variants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bullet_variants" ADD CONSTRAINT "bullet_variants_bullet_id_library_bullets_id_fk" FOREIGN KEY ("bullet_id") REFERENCES "public"."library_bullets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_bullets" ADD CONSTRAINT "library_bullets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_bullets" ADD CONSTRAINT "library_bullets_item_id_library_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."library_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_item_links" ADD CONSTRAINT "resume_item_links_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_item_links" ADD CONSTRAINT "resume_item_links_item_id_library_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."library_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_item_links" ADD CONSTRAINT "resume_item_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bullet_variants_user_id_idx" ON "bullet_variants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bullet_variants_bullet_id_idx" ON "bullet_variants" USING btree ("bullet_id");--> statement-breakpoint
CREATE INDEX "library_bullets_user_id_idx" ON "library_bullets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "library_bullets_item_id_idx" ON "library_bullets" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "library_items_user_id_idx" ON "library_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_item_links_user_id_idx" ON "resume_item_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_item_links_item_id_idx" ON "resume_item_links" USING btree ("item_id");
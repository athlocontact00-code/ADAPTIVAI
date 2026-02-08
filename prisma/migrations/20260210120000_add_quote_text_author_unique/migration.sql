-- CreateIndex
CREATE UNIQUE INDEX "quotes_text_author_key" ON "quotes"("text", "author");

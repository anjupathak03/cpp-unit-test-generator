#include <gtest/gtest.h>

// Forward declaration for the function we're testing
int add(int a, int b);

TEST(AddTest, HandlesPositiveInput) {
    EXPECT_EQ(add(1, 2), 3);
}

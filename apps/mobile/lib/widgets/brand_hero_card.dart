import 'package:flutter/material.dart';

class BrandHeroCard extends StatelessWidget {
  final String eyebrow;
  final String title;
  final String subtitle;
  final IconData icon;

  const BrandHeroCard({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF073A80), Color(0xFF0756CF)],
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -38,
            right: -14,
            child: Container(
              width: 116,
              height: 116,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white.withOpacity(0.14)),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        eyebrow.toUpperCase(),
                        style: const TextStyle(
                          color: Color(0xFFDCEAFF),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 19,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          color: Color(0xFFDCEAFF),
                          fontSize: 11,
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.14),
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(color: Colors.white.withOpacity(0.17)),
                  ),
                  child: Icon(icon, color: const Color(0xFFFFD238), size: 25),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

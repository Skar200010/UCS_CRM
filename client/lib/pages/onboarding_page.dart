import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../main.dart';

class OnboardingPage extends StatefulWidget {
  final VoidCallback onComplete;
  const OnboardingPage({super.key, required this.onComplete});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final PageController _pageController = PageController();
  int _currentStep = 0;
  bool _submitting = false;
  bool _loadingData = true;
  bool _photoUploading = false;
  String? _uploadedPhotoUrl;
  File? _selectedImage;
  bool _alreadyCompleted = false;

  // Personal Details
  final _nameCtrl = TextEditingController();
  final _fatherNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _altPhoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _pincodeCtrl = TextEditingController();
  final _panNumberCtrl = TextEditingController();
  final _aadharNumberCtrl = TextEditingController();
  String _gender = 'Male';
  String _maritalStatus = 'Single';
  DateTime? _dob;

  // Correspondence Address (optional)
  bool _hasCorrespondenceAddress = false;
  final _corrAddressCtrl = TextEditingController();
  final _corrCityCtrl = TextEditingController();
  final _corrStateCtrl = TextEditingController();
  final _corrPincodeCtrl = TextEditingController();

  // Bank Details
  final _bankNameCtrl = TextEditingController();
  final _accountHolderCtrl = TextEditingController();
  final _ifscCtrl = TextEditingController();
  final _accountNoCtrl = TextEditingController();

  // Education (single entry only)
  final _degreeCtrl = TextEditingController();
  final _institutionCtrl = TextEditingController();
  final _universityCtrl = TextEditingController();
  final _fromYearCtrl = TextEditingController();
  final _toYearCtrl = TextEditingController();
  final _yearCtrl = TextEditingController();
  final _percentageCtrl = TextEditingController();

  // Previous organization entries
  final List<_OrganizationEntry> _organizationList = [];

  // Family / References entries (max 3)
  final List<_PersonEntry> _personList = [];

  final List<String> _steps = [
    'Personal Details',
    'Education',
    'Previous Organizations',
    'Family Details / References',
    'Photo',
    'Review',
    'Complete',
  ];

  @override
  void initState() {
    super.initState();
    _initOnboarding();
  }

  Future<void> _initOnboarding() async {
    await _loadWorkerData();
    setState(() => _loadingData = false);
  }

  @override
  void dispose() {
    _pageController.dispose();
    _nameCtrl.dispose();
    _fatherNameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _altPhoneCtrl.dispose();
    _addressCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    _pincodeCtrl.dispose();
    _panNumberCtrl.dispose();
    _aadharNumberCtrl.dispose();
    _corrAddressCtrl.dispose();
    _corrCityCtrl.dispose();
    _corrStateCtrl.dispose();
    _corrPincodeCtrl.dispose();
    _bankNameCtrl.dispose();
    _accountHolderCtrl.dispose();
    _ifscCtrl.dispose();
    _accountNoCtrl.dispose();
    _degreeCtrl.dispose();
    _institutionCtrl.dispose();
    _universityCtrl.dispose();
    _fromYearCtrl.dispose();
    _toYearCtrl.dispose();
    _yearCtrl.dispose();
    _percentageCtrl.dispose();
    for (final o in _organizationList) o.dispose();
    for (final p in _personList) p.dispose();
    super.dispose();
  }

  Future<void> _loadWorkerData() async {
    final worker = await ApiService.getWorkerData();
    if (worker != null) {
      _nameCtrl.text = worker['name'] ?? '';
      if (worker['father_husband_name'] != null) _fatherNameCtrl.text = worker['father_husband_name'];
      _emailCtrl.text = worker['email'] ?? '';
      if (worker['gender'] != null) _gender = worker['gender'];
      if (worker['phone'] != null) _phoneCtrl.text = worker['phone'];
      if (worker['alternate_phone'] != null) _altPhoneCtrl.text = worker['alternate_phone'];
      if (worker['address'] != null) _addressCtrl.text = worker['address'];
      if (worker['city'] != null) _cityCtrl.text = worker['city'];
      if (worker['state'] != null) _stateCtrl.text = worker['state'];
      if (worker['pincode'] != null) _pincodeCtrl.text = worker['pincode'];
      if (worker['correspondence'] != null && worker['correspondence'] is Map) {
        final corr = worker['correspondence'];
        if (corr['address'] != null && corr['address'].toString().isNotEmpty) {
          _hasCorrespondenceAddress = true;
          _corrAddressCtrl.text = corr['address'];
          if (corr['city'] != null) _corrCityCtrl.text = corr['city'];
          if (corr['state'] != null) _corrStateCtrl.text = corr['state'];
          if (corr['pincode'] != null) _corrPincodeCtrl.text = corr['pincode'];
        }
      }
      if (worker['photo_url'] != null) _uploadedPhotoUrl = worker['photo_url'];
      if (worker['dob'] != null) _dob = DateTime.tryParse(worker['dob'].toString());
      if (worker['marital_status'] != null) _maritalStatus = worker['marital_status'];
      if (worker['pan_number'] != null) _panNumberCtrl.text = worker['pan_number'];
      if (worker['aadhar_number'] != null) _aadharNumberCtrl.text = worker['aadhar_number'];
      if (worker['bank_name'] != null) _bankNameCtrl.text = worker['bank_name'];
      if (worker['account_holder_name'] != null) _accountHolderCtrl.text = worker['account_holder_name'];
      if (worker['ifsc_code'] != null) _ifscCtrl.text = worker['ifsc_code'];
      if (worker['account_number'] != null) _accountNoCtrl.text = worker['account_number'];
      final education = worker['education'];
      if (education is List && education.isNotEmpty) {
        final ed = education.first;
        if (ed is Map) {
          _degreeCtrl.text = ed['degree'] ?? '';
          _institutionCtrl.text = ed['institution'] ?? '';
          _universityCtrl.text = ed['university'] ?? '';
          _yearCtrl.text = ed['year_of_passing']?.toString() ?? '';
          _percentageCtrl.text = ed['percentage'] ?? '';
          if (ed['from_year'] != null) _fromYearCtrl.text = ed['from_year'].toString();
          if (ed['to_year'] != null) _toYearCtrl.text = ed['to_year'].toString();
        }
      }
      final organizations = worker['previous_organizations'];
      if (organizations is List) {
        for (final org in organizations) {
          if (org is Map) {
            _organizationList.add(_OrganizationEntry.fromMap(org));
          }
        }
      }
      final family = worker['family'];
      if (family is List) {
        for (final f in family) {
          if (f is Map) {
            _personList.add(_PersonEntry.fromMap(f));
          }
        }
      }
      final references = worker['references'];
      if (references is List) {
        for (final r in references) {
          if (r is Map) {
            _personList.add(_PersonEntry.fromMap(r));
          }
        }
      }
    }
    setState(() {});
  }

  Future<void> _pickPhoto() async {
    final prevStep = _currentStep;
    try {
      final picker = ImagePicker();
      final XFile? image = await picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 80,
      );
      if (image == null) return;

      setState(() {
        _selectedImage = File(image.path);
        _photoUploading = true;
      });
      await _uploadPhoto();

      if (mounted && _currentStep != prevStep) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_pageController.hasClients) _pageController.jumpToPage(prevStep);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to capture image: $e'), backgroundColor: Colors.red.shade700),
        );
      }
    } finally {
      if (mounted) setState(() => _photoUploading = false);
    }
  }

  Future<void> _uploadPhoto() async {
    if (_selectedImage == null) return;
    try {
      final bytes = await _selectedImage!.readAsBytes();
      final base64Photo = base64Encode(bytes);
      final result = await ApiService.uploadPhoto(base64Photo, 'image/jpeg');
      setState(() => _uploadedPhotoUrl = result['photo_url']);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Photo uploaded successfully'), backgroundColor: Color(0xFF2563eb)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e'), backgroundColor: Colors.red.shade700),
        );
      }
    }
  }

  bool _validatePersonal() {
    if (_nameCtrl.text.trim().isEmpty) { _showError('Name is required'); return false; }
    if (_emailCtrl.text.trim().isEmpty) { _showError('Email is required'); return false; }
    if (!_emailCtrl.text.contains('@')) { _showError('Enter a valid email'); return false; }
    if (_phoneCtrl.text.trim().isEmpty) { _showError('Phone number is required'); return false; }
    if (_phoneCtrl.text.trim().length < 10) { _showError('Enter a valid phone number'); return false; }
    return true;
  }

  bool _validateEducation() {
    if (_degreeCtrl.text.trim().isEmpty) { _showError('Highest qualification is required'); return false; }
    if (_institutionCtrl.text.trim().isEmpty) { _showError('Institution is required'); return false; }
    return true;
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.red.shade700),
    );
  }

  Future<void> _submitOnboarding() async {
    setState(() => _submitting = true);
    try {
      await ApiService.submitOnboarding(
        personalDetails: {
          'name': _nameCtrl.text.trim(),
          'father_husband_name': _fatherNameCtrl.text.trim(),
          'email': _emailCtrl.text.trim(),
          'phone': _phoneCtrl.text.trim(),
          'alternate_phone': _altPhoneCtrl.text.trim(),
          'gender': _gender,
          'dob': _dob?.toIso8601String().split('T')[0],
          'address': _addressCtrl.text.trim(),
          'city': _cityCtrl.text.trim(),
          'state': _stateCtrl.text.trim(),
          'pincode': _pincodeCtrl.text.trim(),
          'correspondence': _hasCorrespondenceAddress ? {
            'address': _corrAddressCtrl.text.trim(),
            'city': _corrCityCtrl.text.trim(),
            'state': _corrStateCtrl.text.trim(),
            'pincode': _corrPincodeCtrl.text.trim(),
          } : null,
          'photo_url': _uploadedPhotoUrl,
          'bank_name': _bankNameCtrl.text.trim(),
          'account_holder_name': _accountHolderCtrl.text.trim(),
          'ifsc_code': _ifscCtrl.text.trim(),
          'account_number': _accountNoCtrl.text.trim(),
          'marital_status': _maritalStatus,
          'pan_number': _panNumberCtrl.text.trim(),
          'aadhar_number': _aadharNumberCtrl.text.trim(),
        },
        education: _degreeCtrl.text.trim().isNotEmpty
            ? [{
                'degree': _degreeCtrl.text.trim(),
                'institution': _institutionCtrl.text.trim(),
                'university': _universityCtrl.text.trim(),
                'year_of_passing': _yearCtrl.text.trim(),
                'from_year': _fromYearCtrl.text.trim(),
                'to_year': _toYearCtrl.text.trim(),
                'percentage': _percentageCtrl.text.trim(),
              }]
            : [],
        family: _personList
            .where((p) => p.nameCtrl.text.trim().isNotEmpty)
            .map((p) => {
              'name': p.nameCtrl.text.trim(),
              'relationship': p.roleCtrl.text.trim(),
              'occupation': p.orgCtrl.text.trim(),
              'phone': p.phoneCtrl.text.trim(),
            })
            .toList(),
        references: const [],
        previousOrganizations: _organizationList
            .where((o) => o.nameCtrl.text.trim().isNotEmpty)
            .map((o) => {
              'organization_name': o.nameCtrl.text.trim(),
              'role': o.roleCtrl.text.trim(),
              'from_year': o.fromYearCtrl.text.trim(),
              'to_year': o.toYearCtrl.text.trim(),
            })
            .toList(),
      );
      if (!mounted) return;
      _pageController.jumpToPage(_steps.length - 1);
    } catch (e) {
      if (!mounted) return;
      _showError(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _goNext() {
    switch (_currentStep) {
      case 0: if (!_validatePersonal()) return; break;
      case 1: if (!_validateEducation()) return; break;
    }
    if (_currentStep < _steps.length - 1) {
      _pageController.nextPage(duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final scale = (screenWidth / 375).clamp(0.85, 1.3);
    final sc = Theme.of(context).colorScheme;

    if (_loadingData) {
      return Scaffold(
        backgroundColor: sc.surface,
        body: SafeArea(child: _buildLoadingSkeleton()),
      );
    }

    if (_alreadyCompleted) {
      return Scaffold(
        backgroundColor: sc.surface,
        body: const SafeArea(child: SizedBox.shrink()),
      );
    }

    return Scaffold(
      backgroundColor: sc.surface,
      body: SafeArea(
        child: MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(scale),
          ),
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: PageView(
                  controller: _pageController,
                  onPageChanged: (i) => setState(() => _currentStep = i),
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    _buildPersonalDetails(),
                    _buildEducation(),
                    _buildPreviousOrganizations(),
                    _buildFamilyDetails(),
                    _buildPhotoUpload(),
                    _buildReview(),
                    _buildSuccessScreen(),
                  ],
                ),
              ),
              if (_currentStep < _steps.length - 2)
                _buildBottomNav()
              else if (_currentStep == _steps.length - 2)
                _buildSubmitButton()
              else
                _buildSuccessButtons(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoadingSkeleton() {
    final sc = Theme.of(context).colorScheme;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(color: sc.secondary),
          const SizedBox(height: 20),
          Text('Loading...', style: GoogleFonts.manrope(fontSize: 16, color: sc.onSurfaceVariant)),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Column(
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () {
                  if (_currentStep > 0) {
                    _pageController.previousPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
                  }
                },
                child: Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: _currentStep > 0 ? colors.surfaceContainerLow : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    border: _currentStep > 0 ? Border.all(color: colors.outline) : null,
                  ),
                  child: Icon(
                    Icons.arrow_back_ios_new_rounded,
                    color: _currentStep > 0 ? sc.onSurfaceVariant : Colors.transparent,
                    size: 18,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  _steps[_currentStep],
                  style: GoogleFonts.hankenGrotesk(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: sc.onSurface,
                    letterSpacing: -0.3,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: colors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${_currentStep + 1}/${_steps.length}',
                  style: GoogleFonts.manrope(fontSize: 12, fontWeight: FontWeight.w600, color: sc.onSurfaceVariant),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (_currentStep + 1) / _steps.length,
              backgroundColor: colors.surfaceContainerHigh,
              valueColor: AlwaysStoppedAnimation<Color>(sc.secondary),
              minHeight: 4,
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildBottomNav() {
    final sc = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: _goNext,
          style: ElevatedButton.styleFrom(
            backgroundColor: sc.secondary,
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: Text('Continue', style: GoogleFonts.hankenGrotesk(
            fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.2,
          )),
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    final sc = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: _submitting ? null : _submitOnboarding,
          style: ElevatedButton.styleFrom(
            backgroundColor: sc.secondary,
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: _submitting
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.check_circle_rounded, size: 20),
                    const SizedBox(width: 8),
                    Text('Complete Setup', style: GoogleFonts.hankenGrotesk(
                      fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.2,
                    )),
                  ],
                ),
        ),
      ),
    );
  }

  // ---- STEP 1: PERSONAL DETAILS ----

  Widget _buildPersonalDetails() {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('Basic Information'),
          const SizedBox(height: 14),
          _textField(_nameCtrl, 'Full Name *', Icons.person, 'Enter your full name'),
          const SizedBox(height: 12),
          _textField(_fatherNameCtrl, 'Father / Husband Name', Icons.person_outline, "Father's or husband's name"),
          const SizedBox(height: 12),
          _textField(_emailCtrl, 'Email *', Icons.email, 'Enter your email'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _textField(_phoneCtrl, 'Phone *', Icons.phone, '10-digit number', keyboardType: TextInputType.phone)),
              const SizedBox(width: 12),
              Expanded(child: _textField(_altPhoneCtrl, 'Alt. Phone', Icons.phone, 'Optional', keyboardType: TextInputType.phone)),
            ],
          ),
          const SizedBox(height: 16),
          _sectionTitle('Personal Info'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _dropdownField('Gender', _gender, ['Male', 'Female', 'Other'], (v) => setState(() => _gender = v!)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _dob ?? DateTime(2000, 1, 1),
                      firstDate: DateTime(1950),
                      lastDate: DateTime.now().subtract(const Duration(days: 365 * 15)),
                    );
                    if (date != null) setState(() => _dob = date);
                  },
                  child: Container(
                    height: 52,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: colors.surfaceContainerLowest,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: colors.outline),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.calendar_today, size: 19, color: sc.onSurfaceVariant),
                        const SizedBox(width: 10),
                        Text(
                          _dob != null ? '${_dob!.day}/${_dob!.month}/${_dob!.year}' : 'Date of Birth',
                          style: TextStyle(fontSize: 14, color: _dob != null ? sc.onSurface : sc.outline),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _dropdownField('Marital Status', _maritalStatus, ['Single', 'Married', 'Divorced', 'Widowed'], (v) => setState(() => _maritalStatus = v!)),
          const SizedBox(height: 16),
          _sectionTitle('Permanent Address'),
          const SizedBox(height: 12),
          _textField(_addressCtrl, 'Address *', Icons.home, 'Street, area, landmark'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _textField(_cityCtrl, 'City *', Icons.location_city, 'City')),
              const SizedBox(width: 12),
              Expanded(child: _textField(_stateCtrl, 'State *', Icons.map, 'State')),
            ],
          ),
          const SizedBox(height: 12),
          _textField(_pincodeCtrl, 'Pincode *', Icons.pin, '6-digit pincode', keyboardType: TextInputType.number, maxLength: 6),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => setState(() => _hasCorrespondenceAddress = !_hasCorrespondenceAddress),
            child: Row(
              children: [
                Icon(
                  _hasCorrespondenceAddress ? Icons.check_box : Icons.check_box_outline_blank,
                  size: 22,
                  color: sc.secondary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Add correspondence address (if different)',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: sc.onSurfaceVariant),
                  ),
                ),
              ],
            ),
          ),
          if (_hasCorrespondenceAddress) ...[
            const SizedBox(height: 12),
            _sectionTitle('Correspondence Address'),
            const SizedBox(height: 12),
            _textField(_corrAddressCtrl, 'Address', Icons.mail_outline, 'Street, area, landmark'),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _textField(_corrCityCtrl, 'City', Icons.location_city, 'City')),
                const SizedBox(width: 12),
                Expanded(child: _textField(_corrStateCtrl, 'State', Icons.map, 'State')),
              ],
            ),
            const SizedBox(height: 12),
            _textField(_corrPincodeCtrl, 'Pincode', Icons.pin, '6-digit pincode', keyboardType: TextInputType.number, maxLength: 6),
          ],
          const SizedBox(height: 16),
          _sectionTitle('Identity Numbers'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _textField(_panNumberCtrl, 'PAN Number', Icons.assignment, 'e.g., ABCDE1234F')),
              const SizedBox(width: 12),
              Expanded(child: _textField(_aadharNumberCtrl, 'Aadhaar Number', Icons.credit_card, '12-digit number', keyboardType: TextInputType.number, maxLength: 12)),
            ],
          ),
          const SizedBox(height: 16),
          _sectionTitle('Bank Account Details'),
          const SizedBox(height: 12),
          _textField(_bankNameCtrl, 'Bank Name *', Icons.account_balance, 'e.g., State Bank of India'),
          const SizedBox(height: 12),
          _textField(_accountHolderCtrl, 'Account Holder Name *', Icons.person, 'As per bank records'),
          const SizedBox(height: 12),
          _textField(_ifscCtrl, 'IFSC Code *', Icons.code, 'e.g., SBIN0001234'),
          const SizedBox(height: 12),
          _textField(_accountNoCtrl, 'Account Number *', Icons.pin, 'Your bank account number', keyboardType: TextInputType.number),
          const SizedBox(height: 8),
          Text('These details will be used for salary disbursement',
            style: TextStyle(fontSize: 12, color: sc.outline)),
        ],
      ),
    );
  }

  // ---- STEP 2: EDUCATION ----

  Widget _buildEducation() {
    final sc = Theme.of(context).colorScheme;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('Highest Qualification'),
          const SizedBox(height: 4),
          Text('Enter your highest educational qualification', style: TextStyle(fontSize: 13, color: sc.onSurfaceVariant)),
          const SizedBox(height: 12),
          _textField(_degreeCtrl, 'Degree / Qualification *', Icons.school, 'e.g., B.Sc, B.Com, MBA, 12th'),
          const SizedBox(height: 12),
          _textField(_institutionCtrl, 'Institution *', Icons.business, 'College / School name'),
          const SizedBox(height: 12),
          _textField(_universityCtrl, 'University', Icons.account_balance, 'University name'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _textField(_fromYearCtrl, 'From Year', Icons.calendar_today, 'e.g., 2018', keyboardType: TextInputType.number)),
              const SizedBox(width: 12),
              Expanded(child: _textField(_toYearCtrl, 'To Year', Icons.calendar_today, 'e.g., 2022', keyboardType: TextInputType.number)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _textField(_yearCtrl, 'Year of Passing', Icons.calendar_today, 'e.g., 2022', keyboardType: TextInputType.number)),
              const SizedBox(width: 12),
              Expanded(child: _textField(_percentageCtrl, 'Percentage / Grade', Icons.percent, 'e.g., 85% or A+')),
            ],
          ),
        ],
      ),
    );
  }

  // ---- STEP 3: PREVIOUS ORGANIZATIONS ----

  Widget _buildPreviousOrganizations() {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('Previous Organization'),
          const SizedBox(height: 4),
          Text('Add your previous work experience (optional)', style: TextStyle(fontSize: 13, color: sc.onSurfaceVariant)),
          const SizedBox(height: 14),
          if (_organizationList.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 36),
              width: double.infinity,
              decoration: BoxDecoration(
                color: colors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: colors.outline),
              ),
              child: Column(
                children: [
                  Icon(Icons.work_history_outlined, size: 40, color: sc.outline),
                  const SizedBox(height: 10),
                  Text('No previous organization added', style: TextStyle(fontSize: 13, color: sc.onSurfaceVariant)),
                ],
              ),
            )
          else
            ..._organizationList.asMap().entries.map((entry) {
              final i = entry.key;
              final o = entry.value;
              return Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: sc.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: colors.outline),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(5),
                          decoration: BoxDecoration(
                            color: sc.secondary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: Icon(Icons.business_center, size: 15, color: sc.secondary),
                        ),
                        const SizedBox(width: 8),
                        Text('Organization', style: GoogleFonts.hankenGrotesk(
                          fontSize: 14, fontWeight: FontWeight.w700, color: sc.onSurface,
                        )),
                        const Spacer(),
                        GestureDetector(
                          onTap: () {
                            o.dispose();
                            setState(() => _organizationList.removeAt(i));
                          },
                          child: Container(
                            padding: const EdgeInsets.all(5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFfee2e2).withValues(alpha: 0.8),
                              borderRadius: BorderRadius.circular(7),
                            ),
                            child: const Icon(Icons.close, size: 16, color: Color(0xFFdc2626)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _textField(o.nameCtrl, 'Organization Name *', Icons.business, 'Company / Organization name'),
                    const SizedBox(height: 10),
                    _textField(o.roleCtrl, 'Role / Designation', Icons.badge, 'Your job title'),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(child: _textField(o.fromYearCtrl, 'From Year', Icons.calendar_today, 'e.g., 2020', keyboardType: TextInputType.number)),
                        const SizedBox(width: 10),
                        Expanded(child: _textField(o.toYearCtrl, 'To Year', Icons.calendar_today, 'e.g., 2023', keyboardType: TextInputType.number)),
                      ],
                    ),
                  ],
                ),
              );
            }),
          if (_organizationList.isEmpty)
            Center(
              child: TextButton.icon(
                onPressed: () => setState(() => _organizationList.add(_OrganizationEntry())),
                icon: Icon(Icons.add_circle_outline, color: sc.secondary),
                label: Text('Add Previous Organization',
                  style: GoogleFonts.manrope(fontSize: 14, fontWeight: FontWeight.w600, color: sc.secondary)),
              ),
            ),
        ],
      ),
    );
  }

  // ---- STEP 4: FAMILY DETAILS / REFERENCES ----

  Widget _buildFamilyDetails() {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('Family Details / References'),
          const SizedBox(height: 4),
          Text('Add up to 3 family members or references', style: TextStyle(fontSize: 13, color: sc.onSurfaceVariant)),
          const SizedBox(height: 14),
          if (_personList.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 36),
              width: double.infinity,
              decoration: BoxDecoration(
                color: colors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: colors.outline),
              ),
              child: Column(
                children: [
                  Icon(Icons.family_restroom_outlined, size: 40, color: sc.outline),
                  const SizedBox(height: 10),
                  Text('No entries added yet', style: TextStyle(fontSize: 13, color: sc.onSurfaceVariant)),
                ],
              ),
            )
          else
            ..._personList.asMap().entries.map((entry) {
              final i = entry.key;
              final p = entry.value;
              return Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: sc.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: colors.outline),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(5),
                          decoration: BoxDecoration(
                            color: sc.secondary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: Icon(Icons.person_outline_rounded, size: 15, color: sc.secondary),
                        ),
                        const SizedBox(width: 8),
                        Text('Entry ${i + 1}', style: GoogleFonts.hankenGrotesk(
                          fontSize: 14, fontWeight: FontWeight.w700, color: sc.onSurface,
                        )),
                        const Spacer(),
                        GestureDetector(
                          onTap: () {
                            p.dispose();
                            setState(() => _personList.removeAt(i));
                          },
                          child: Container(
                            padding: const EdgeInsets.all(5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFfee2e2).withValues(alpha: 0.8),
                              borderRadius: BorderRadius.circular(7),
                            ),
                            child: const Icon(Icons.close, size: 16, color: Color(0xFFdc2626)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _textField(p.nameCtrl, 'Name *', Icons.person, 'Full name'),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(child: _textField(p.roleCtrl, 'Relationship', Icons.people, 'e.g., Father, Manager')),
                        const SizedBox(width: 10),
                        Expanded(child: _textField(p.orgCtrl, 'Occupation', Icons.work, 'Optional')),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _textField(p.phoneCtrl, 'Phone', Icons.phone, 'Optional', keyboardType: TextInputType.phone),
                  ],
                ),
              );
            }),
          if (_personList.length < 3)
            Center(
              child: TextButton.icon(
                onPressed: () => setState(() => _personList.add(_PersonEntry())),
                icon: Icon(Icons.add_circle_outline, color: sc.secondary),
                label: Text('Add Entry (${_personList.length}/3)',
                  style: GoogleFonts.manrope(fontSize: 14, fontWeight: FontWeight.w600, color: sc.secondary)),
              ),
            ),
        ],
      ),
    );
  }

  // ---- STEP 5: PHOTO UPLOAD ----

  Widget _buildPhotoUpload() {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('Profile Photo'),
          const SizedBox(height: 4),
          Text('Take a recent passport-size photograph', style: TextStyle(fontSize: 13, color: sc.onSurfaceVariant)),
          const SizedBox(height: 28),
          Center(
            child: GestureDetector(
              onTap: _photoUploading ? null : _pickPhoto,
              child: Container(
                width: 180,
                height: 180,
                decoration: BoxDecoration(
                  color: colors.surfaceContainerLow,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: _uploadedPhotoUrl != null ? sc.secondary : colors.outline,
                    width: 3,
                  ),
                ),
                child: ClipOval(
                  child: _photoUploading
                      ? Container(
                          color: sc.inverseSurface.withValues(alpha: 0.3),
                          child: const Center(child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3)),
                        )
                      : _uploadedPhotoUrl != null
                          ? Image.network(_uploadedPhotoUrl!, fit: BoxFit.cover, width: 180, height: 180,
                              errorBuilder: (_, __, ___) => _photoPlaceholder())
                          : _selectedImage != null
                              ? Image.file(_selectedImage!, fit: BoxFit.cover, width: 180, height: 180)
                              : _photoPlaceholder(),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Center(
            child: TextButton.icon(
              onPressed: _photoUploading ? null : _pickPhoto,
              icon: _photoUploading
                  ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: sc.secondary))
                  : Icon(Icons.camera_alt_rounded, color: sc.onSurfaceVariant),
              label: Text(
                _photoUploading ? 'Uploading...' : (_uploadedPhotoUrl != null ? 'Retake Photo' : 'Tap to Take Photo'),
                style: GoogleFonts.manrope(fontSize: 14, fontWeight: FontWeight.w600, color: sc.onSurfaceVariant),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _photoPlaceholder() {
    final sc = Theme.of(context).colorScheme;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.person_outline_rounded, size: 52, color: sc.outline),
          const SizedBox(height: 4),
          Text('Photo', style: TextStyle(fontSize: 12, color: sc.outline)),
        ],
      ),
    );
  }

  // ---- STEP 6: REVIEW & SUBMIT ----

  Widget _buildReview() {
    final sc = Theme.of(context).colorScheme;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('Review Your Information'),
          const SizedBox(height: 4),
          Text('Please verify everything before submitting', style: TextStyle(fontSize: 13, color: sc.onSurfaceVariant)),
          const SizedBox(height: 16),
          _reviewCard('Personal Details', Icons.person, [
            _reviewItem('Name', _nameCtrl.text),
            if (_fatherNameCtrl.text.isNotEmpty) _reviewItem('Father/Husband', _fatherNameCtrl.text),
            _reviewItem('Email', _emailCtrl.text),
            _reviewItem('Phone', _phoneCtrl.text),
            if (_altPhoneCtrl.text.isNotEmpty) _reviewItem('Alt Phone', _altPhoneCtrl.text),
            _reviewItem('Gender', _gender),
            if (_dob != null) _reviewItem('DOB', '${_dob!.day}/${_dob!.month}/${_dob!.year}'),
            _reviewItem('Marital Status', _maritalStatus),
            if (_panNumberCtrl.text.isNotEmpty) _reviewItem('PAN', _panNumberCtrl.text),
            if (_aadharNumberCtrl.text.isNotEmpty) _reviewItem('Aadhaar', _aadharNumberCtrl.text),
            if (_addressCtrl.text.isNotEmpty) _reviewItem('Address', _addressCtrl.text),
            if (_cityCtrl.text.isNotEmpty) _reviewItem('City', _cityCtrl.text),
            if (_stateCtrl.text.isNotEmpty) _reviewItem('State', _stateCtrl.text),
            if (_pincodeCtrl.text.isNotEmpty) _reviewItem('Pincode', _pincodeCtrl.text),
            if (_hasCorrespondenceAddress && _corrAddressCtrl.text.isNotEmpty) _reviewItem('Corr. Address', _corrAddressCtrl.text),
            if (_hasCorrespondenceAddress && _corrCityCtrl.text.isNotEmpty) _reviewItem('Corr. City', _corrCityCtrl.text),
            if (_hasCorrespondenceAddress && _corrStateCtrl.text.isNotEmpty) _reviewItem('Corr. State', _corrStateCtrl.text),
            if (_hasCorrespondenceAddress && _corrPincodeCtrl.text.isNotEmpty) _reviewItem('Corr. Pincode', _corrPincodeCtrl.text),
          ]),
          const SizedBox(height: 12),
          _reviewCard('Bank Details', Icons.account_balance, [
            if (_bankNameCtrl.text.isNotEmpty) _reviewItem('Bank Name', _bankNameCtrl.text),
            if (_accountHolderCtrl.text.isNotEmpty) _reviewItem('Account Holder', _accountHolderCtrl.text),
            if (_ifscCtrl.text.isNotEmpty) _reviewItem('IFSC', _ifscCtrl.text),
            if (_accountNoCtrl.text.isNotEmpty) _reviewItem('Account No', _accountNoCtrl.text),
          ]),
          const SizedBox(height: 12),
          if (_degreeCtrl.text.isNotEmpty)
            _reviewCard('Education', Icons.school, [
              _reviewItem(
                _degreeCtrl.text,
                '${_institutionCtrl.text}${_yearCtrl.text.isNotEmpty ? ' (${_yearCtrl.text})' : ''}',
              ),
            ]),
          const SizedBox(height: 12),
          if (_organizationList.any((o) => o.nameCtrl.text.isNotEmpty))
            _reviewCard('Previous Organizations', Icons.work_history,
              _organizationList.where((o) => o.nameCtrl.text.isNotEmpty).map((o) => _reviewItem(
                o.nameCtrl.text,
                '${o.roleCtrl.text.isNotEmpty ? '${o.roleCtrl.text} · ' : ''}${o.fromYearCtrl.text.isNotEmpty ? '${o.fromYearCtrl.text}' : ''}${o.toYearCtrl.text.isNotEmpty ? ' - ${o.toYearCtrl.text}' : ''}',
              )).toList(),
            ),
          const SizedBox(height: 12),
          if (_personList.any((p) => p.nameCtrl.text.isNotEmpty))
            _reviewCard('Family / References', Icons.family_restroom,
              _personList.where((p) => p.nameCtrl.text.isNotEmpty).map((p) => _reviewItem(
                p.nameCtrl.text,
                '${p.roleCtrl.text}${p.orgCtrl.text.isNotEmpty ? ' · ${p.orgCtrl.text}' : ''}',
              )).toList(),
            ),
          const SizedBox(height: 12),
          _reviewCard('Photo', Icons.check_circle, [
            _reviewItem('Photo', _uploadedPhotoUrl != null ? 'Uploaded' : 'Not uploaded'),
          ]),
        ],
      ),
    );
  }

  // ---- SUCCESS SCREEN ----

  Widget _buildSuccessScreen() {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 48),
          Container(
            width: 110,
            height: 110,
            decoration: BoxDecoration(
              color: colors.surfaceContainerLow,
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFF22c55e), width: 3),
            ),
            child: const Icon(Icons.check_circle_rounded, size: 60, color: Color(0xFF22c55e)),
          ),
          const SizedBox(height: 28),
          Text('Onboarding Complete!',
            style: GoogleFonts.hankenGrotesk(
              fontSize: 24, fontWeight: FontWeight.w700, color: sc.onSurface,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Your information has been submitted successfully.\nYou can now start marking your attendance.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, height: 1.6, color: sc.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessButtons() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: SafeArea(
        top: false,
        child: SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: widget.onComplete,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF22c55e),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text('Go to Dashboard', style: GoogleFonts.hankenGrotesk(
              fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.2,
            )),
          ),
        ),
      ),
    );
  }

  // ---- Helper Widgets ----

  Widget _sectionTitle(String title) {
    final sc = Theme.of(context).colorScheme;
    return Row(
      children: [
        Container(
          width: 3, height: 18,
          decoration: BoxDecoration(
            color: sc.secondary,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 10),
        Text(title, style: GoogleFonts.hankenGrotesk(
          fontSize: 16, fontWeight: FontWeight.w600, color: sc.onSurface,
          letterSpacing: -0.3,
        )),
      ],
    );
  }

  Widget _textField(TextEditingController ctrl, String label, IconData icon, String hint, {TextInputType? keyboardType, int? maxLength}) {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.outline),
      ),
      child: TextField(
        controller: ctrl,
        keyboardType: keyboardType,
        maxLength: maxLength,
        style: TextStyle(fontSize: 14, color: sc.onSurface),
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          hintStyle: TextStyle(fontSize: 13, color: sc.outline),
          prefixIcon: Icon(icon, size: 19, color: sc.onSurfaceVariant),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
          counterText: '',
          labelStyle: TextStyle(fontSize: 13, color: sc.onSurfaceVariant),
        ),
      ),
    );
  }

  Widget _dropdownField(String label, String value, List<String> items, ValueChanged<String?> onChanged) {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    final allItems = ['', ...items];
    final effectiveValue = items.contains(value) ? value : '';
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: colors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.outline),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: effectiveValue,
          isExpanded: true,
          icon: Icon(Icons.expand_more, size: 20, color: sc.outline),
          style: TextStyle(fontSize: 14, color: sc.onSurface),
          items: allItems.map((item) => DropdownMenuItem(
            value: item,
            child: Text(item.isEmpty ? label : item),
          )).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _reviewCard(String title, IconData icon, List<Widget> items) {
    final sc = Theme.of(context).colorScheme;
    final colors = Theme.of(context).extension<AppColors>()!;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: sc.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: sc.secondary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: sc.secondary),
              ),
              const SizedBox(width: 10),
              Text(title, style: GoogleFonts.hankenGrotesk(
                fontSize: 15, fontWeight: FontWeight.w700, color: sc.onSurface,
                letterSpacing: -0.2,
              )),
            ],
          ),
          const SizedBox(height: 12),
          ...items,
        ],
      ),
    );
  }

  Widget _reviewItem(String label, String value) {
    final sc = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: sc.outline)),
          ),
          Expanded(
            child: Text(value.isEmpty ? '—' : value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: sc.onSurface)),
          ),
        ],
      ),
    );
  }
}

class _OrganizationEntry {
  final nameCtrl = TextEditingController();
  final roleCtrl = TextEditingController();
  final fromYearCtrl = TextEditingController();
  final toYearCtrl = TextEditingController();

  _OrganizationEntry();

  _OrganizationEntry.fromMap(Map map) {
    nameCtrl.text = map['organization_name'] ?? map['name'] ?? '';
    roleCtrl.text = map['role'] ?? map['designation'] ?? '';
    fromYearCtrl.text = map['from_year']?.toString() ?? '';
    toYearCtrl.text = map['to_year']?.toString() ?? '';
  }

  void dispose() {
    nameCtrl.dispose();
    roleCtrl.dispose();
    fromYearCtrl.dispose();
    toYearCtrl.dispose();
  }
}

class _PersonEntry {
  final nameCtrl = TextEditingController();
  final roleCtrl = TextEditingController();
  final orgCtrl = TextEditingController();
  final phoneCtrl = TextEditingController();
  DateTime? dob;

  _PersonEntry();

  _PersonEntry.fromMap(Map map) {
    nameCtrl.text = map['name'] ?? '';
    roleCtrl.text = map['relationship'] ?? map['designation'] ?? '';
    orgCtrl.text = map['occupation'] ?? map['organization'] ?? '';
    phoneCtrl.text = map['phone'] ?? '';
    if (map['dob'] != null) {
      dob = DateTime.tryParse(map['dob'].toString());
    }
  }

  void dispose() {
    nameCtrl.dispose();
    roleCtrl.dispose();
    orgCtrl.dispose();
    phoneCtrl.dispose();
  }
}
